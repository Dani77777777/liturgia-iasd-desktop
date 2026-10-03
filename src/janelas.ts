import { BrowserWindow, Display, dialog, nativeImage, screen, shell } from 'electron';
import * as path from 'path';
import { BASE_URL, PROD_URL, DEV_URL } from './config';
import { atualizarUi, avisar, ctx, viva } from './contexto';
import { carregarEventoOnline, definirEvento, difundir, eventoAtual, garantirSync } from './estado-culto';
import { aoMudarIgreja } from './offline-sync';
import { gravar, ler } from './store';
import { aoFecharProjecao } from './updater';

const icone = () => nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png'));
const pagina = (nome: string) => path.join(__dirname, nome);
const ehPainelWeb = (url: string) => url.startsWith(PROD_URL) || url.startsWith(DEV_URL);

// ---------------------------------------------------------------------------
// Window position memory
// ---------------------------------------------------------------------------

function limitesGuardados(chave: string) {
  const l = ler('janelas')?.[chave];
  if (!l) return null;
  // Only reuse if it is still (mostly) on a connected screen
  const visivel = screen.getAllDisplays().some(d =>
    l.x < d.workArea.x + d.workArea.width - 50 && l.x + l.width > d.workArea.x + 50 &&
    l.y < d.workArea.y + d.workArea.height - 50 && l.y + l.height > d.workArea.y + 20);
  return visivel ? l : null;
}

function lembrarLimites(win: BrowserWindow, chave: string) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const guardar = () => {
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    const b = win.getNormalBounds();
    gravar('janelas', { ...(ler('janelas') || {}), [chave]: { ...b, maximized: win.isMaximized() } });
  };
  const adiar = () => { clearTimeout(t); t = setTimeout(guardar, 500); };
  win.on('resize', adiar);
  win.on('move', adiar);
  win.on('close', guardar);
}

// ---------------------------------------------------------------------------
// Main window (web panel, or the offline page)
// ---------------------------------------------------------------------------

export function criarJanelaPrincipal() {
  if (viva(ctx.mainWindow)) {
    if (ctx.mainWindow.isMinimized()) ctx.mainWindow.restore();
    ctx.mainWindow.show();
    ctx.mainWindow.focus();
    return;
  }

  const l = limitesGuardados('principal');
  const win = new BrowserWindow({
    width: l?.width ?? 1280,
    height: l?.height ?? 800,
    x: l?.x,
    y: l?.y,
    title: 'Liturgia IASD - Painel de Controlo',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    autoHideMenuBar: true,
    icon: icone(),
  });
  if (l?.maximized) win.maximize();
  lembrarLimites(win, 'principal');
  ctx.mainWindow = win;

  win.loadURL(`${BASE_URL}/liturgia/agenda?view=hoje`).catch((e: unknown) => {
    console.error('Falha ao carregar o painel:', e);
    mudarParaOffline();
  });

  win.webContents.on('did-fail-load', (_e, codigo, descricao, url, principal) => {
    if (!principal) return;
    console.log(`Falha ao carregar ${url}: ${descricao} (${codigo})`);
    if (codigo <= -100 && codigo > -200) mudarParaOffline(); // Chromium network errors
  });

  win.webContents.on('did-finish-load', () => {
    const url = win.webContents.getURL();
    if (!ehPainelWeb(url)) return;
    if (ctx.isOfflineMode) {
      ctx.isOfflineMode = false;
      atualizarUi();
    }
    // Works even with an older deploy of the site that doesn't call window.electron.setIgreja
    win.webContents.executeJavaScript("localStorage.getItem('liturgia_church_id')")
      .then((v: string | null) => { if (v) aoMudarIgreja(parseInt(v)); })
      .catch(() => {});
  });

  const aoNavegar = (url: string) => {
    if (!ehPainelWeb(url)) return;
    const m = url.match(/\/liturgia\/evento\/(\d+)/);
    if (m) carregarEventoOnline(Number(m[1]));
    else if (eventoAtual()) definirEvento(null);
  };
  win.webContents.on('did-navigate', (_e, url) => aoNavegar(url));
  win.webContents.on('did-navigate-in-page', (_e, url) => aoNavegar(url));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('/present/')) {
      abrirProjecao(url);
    } else if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.on('close', (e) => {
    // Closing the panel closes everything — confirm if a service is being projected
    if (ctx.aSair || !viva(ctx.presentationWindow)) return;
    const r = dialog.showMessageBoxSync(win, {
      type: 'question',
      title: 'Fechar Liturgia IASD?',
      message: 'A projeção está aberta. Fechar o programa também fecha a projeção.',
      buttons: ['Fechar tudo', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
    });
    if (r === 1) e.preventDefault();
  });

  win.on('closed', () => {
    if (viva(ctx.presentationWindow)) ctx.presentationWindow.close();
    if (viva(ctx.controllerWindow)) ctx.controllerWindow.close();
    if (viva(ctx.settingsWindow)) ctx.settingsWindow.close();
    ctx.mainWindow = null;
  });

  atualizarUi();
}

export function mudarParaOffline() {
  if (ctx.isOfflineMode) return;
  console.log('A mudar para o modo offline...');
  ctx.isOfflineMode = true;
  if (viva(ctx.mainWindow)) ctx.mainWindow.loadFile(pagina('offline/index.html'));
  garantirSync();
  // A web projection can't update without internet — swap it for the local one
  if (viva(ctx.presentationWindow) && eventoAtual()) abrirProjecaoDoCulto();
  atualizarUi();
}

export function voltarParaOnline() {
  ctx.isOfflineMode = false;
  const ev = eventoAtual();
  if (viva(ctx.mainWindow)) {
    ctx.mainWindow.loadURL(ev ? `${BASE_URL}/liturgia/evento/${ev.id}` : `${BASE_URL}/liturgia/agenda?view=hoje`);
  }
  if (viva(ctx.presentationWindow) && ev) abrirProjecaoDoCulto();
  garantirSync();
  atualizarUi();
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * The saved projection screen if connected; otherwise another external
 * screen, otherwise the main one — with a notice saying so.
 */
export function escolherEcra(): { ecra: Display; aviso?: string } {
  const ecras = screen.getAllDisplays();
  const principal = screen.getPrimaryDisplay();
  const guardado = ler('projectionDisplayId');
  const escolhido = ecras.find(d => d.id === guardado);
  if (escolhido) return { ecra: escolhido };

  const externo = ecras.find(d => d.id !== principal.id);
  if (guardado === undefined && externo) {
    gravar('projectionDisplayId', externo.id); // first time: remember the external screen
    return { ecra: externo };
  }
  if (guardado !== undefined) {
    return {
      ecra: externo ?? principal,
      aviso: externo
        ? 'O ecrã de projeção escolhido não está ligado. A usar o outro ecrã disponível.'
        : 'O ecrã de projeção escolhido não está ligado. A projeção abriu no ecrã principal.',
    };
  }
  return { ecra: principal, aviso: 'Nenhum segundo ecrã detetado. A projeção abriu no ecrã principal.' };
}

function criarJanelaProjecao(carregar: (w: BrowserWindow) => void) {
  // Already open: just switch what it shows (no dialog in the middle of a service)
  if (viva(ctx.presentationWindow)) {
    carregar(ctx.presentationWindow);
    return;
  }

  const { ecra, aviso } = escolherEcra();
  if (aviso) avisar('Projeção', aviso);

  const win = new BrowserWindow({
    x: ecra.bounds.x,
    y: ecra.bounds.y,
    width: ecra.bounds.width,
    height: ecra.bounds.height,
    fullscreen: true,
    frame: false,
    backgroundColor: '#000000',
    title: 'Liturgia IASD - Projeção',
    webPreferences: {
      preload: path.join(__dirname, 'preload-present.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    icon: icone(),
  });
  ctx.presentationWindow = win;
  carregar(win);
  win.webContents.on('did-finish-load', difundir);
  win.on('closed', () => {
    ctx.presentationWindow = null;
    atualizarUi();
    aoFecharProjecao();
  });
  atualizarUi();
}

/** Open a web projection URL (link clicked in the panel). */
export function abrirProjecao(url: string) {
  if (ctx.isOfflineMode) return abrirProjecaoDoCulto();
  criarJanelaProjecao(w => w.loadURL(url));
}

/** Open the projection of the service loaded in the panel (online or offline). */
export function abrirProjecaoDoCulto() {
  const ev = eventoAtual();
  if (!ev) return;
  if (ctx.isOfflineMode) criarJanelaProjecao(w => w.loadFile(pagina('offline/present.html')));
  else criarJanelaProjecao(w => w.loadURL(`${BASE_URL}/present/${ev.id}`));
}

export function fecharProjecao() {
  if (viva(ctx.presentationWindow)) ctx.presentationWindow.close();
}

/** If the projector is unplugged mid-service, don't leave a fullscreen window over the operator's screen. */
export function aoRemoverEcra() {
  const win = ctx.presentationWindow;
  if (!viva(win)) return;
  const b = win.getBounds();
  const centro = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const principal = screen.getPrimaryDisplay();
  if (screen.getDisplayNearestPoint(centro).id === principal.id && ler('projectionDisplayId') !== principal.id) {
    win.close();
    avisar('Projetor desligado', 'A projeção foi fechada. Volte a abri-la em Culto › Abrir projeção quando o projetor estiver ligado.');
  }
}

// ---------------------------------------------------------------------------
// Controller & settings
// ---------------------------------------------------------------------------

export function alternarJanelaControlo() {
  if (viva(ctx.controllerWindow)) {
    ctx.controllerWindow.close();
    return;
  }
  const l = limitesGuardados('controlo');
  const win = new BrowserWindow({
    width: l?.width ?? 280,
    height: l?.height ?? 500,
    x: l?.x,
    y: l?.y,
    minWidth: 240,
    minHeight: 300,
    maxWidth: 400,
    title: 'Controlo do Culto',
    resizable: true,
    frame: false,
    icon: icone(),
    webPreferences: {
      preload: path.join(__dirname, 'preload-controller.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  // 'screen-saver' keeps it above fullscreen apps (PowerPoint, videos)
  win.setAlwaysOnTop(true, 'screen-saver');
  lembrarLimites(win, 'controlo');
  win.loadFile(pagina('controller.html'));
  ctx.controllerWindow = win;
  win.on('closed', () => {
    ctx.controllerWindow = null;
    garantirSync();
    atualizarUi();
  });
  garantirSync();
  atualizarUi();
}

export function abrirDefinicoes() {
  if (viva(ctx.settingsWindow)) {
    ctx.settingsWindow.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 620,
    height: 760,
    title: 'Definições',
    parent: viva(ctx.mainWindow) ? ctx.mainWindow : undefined,
    autoHideMenuBar: true,
    icon: icone(),
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.setMenu(null);
  win.loadFile(pagina('settings.html'));
  ctx.settingsWindow = win;
  win.on('closed', () => { ctx.settingsWindow = null; });
}
