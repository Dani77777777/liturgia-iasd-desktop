import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import { atualizarUi, ctx } from './contexto';
import { carregarEventoOffline, contarPendentes, dadosOffline, definirEvento, difundir, enviarMensagem, estadoAtual, executarComando } from './estado-culto';
import { abrirProjecaoDoCulto, aoRemoverEcra, criarJanelaPrincipal, voltarParaOnline } from './janelas';
import { iniciarLogger, pastaLogs } from './logger';
import { pararLouvorJA, testarLouvorJA, tocarNoLouvorJA } from './louvorja';
import { iniciarMenuETray } from './menu';
import { agendarSincronizacaoSilenciosa, aoMudarIgreja, sincronizar } from './offline-sync';
import { localizarPastas } from './powerpoint';
import { gravar, iniciarStore, ler } from './store';
import { ComandoCulto } from './tipos';
import { iniciarAtualizacoes } from './updater';

// ============================================
// Squirrel (Windows installer) events — must run before anything else
// ============================================

function tratarEventoSquirrel(): boolean {
  if (process.platform !== 'win32' || process.argv.length === 1) return false;

  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  const exeName = path.basename(process.execPath);
  const correr = (args: string[]) => {
    try { spawn(updateExe, args, { detached: true }); } catch (e) { console.error('Squirrel:', e); }
  };

  switch (process.argv[1]) {
    case '--squirrel-install':
    case '--squirrel-updated':
      correr(['--createShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;
    case '--squirrel-uninstall':
      correr(['--removeShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;
    case '--squirrel-obsolete':
      app.quit();
      return true;
  }
  return false;
}

// ============================================
// IPC
// ============================================

/** Commands come from web content too — only accept the known shapes. */
function comandoValido(c: unknown): c is ComandoCulto {
  if (c === 'next' || c === 'previous' || c === 'stop' || c === 'reset') return true;
  return typeof c === 'object' && c !== null && Number.isInteger((c as { ir?: unknown }).ir);
}

function registarIpc() {
  // Main window (web panel + offline page)
  ipcMain.handle('get-offline-data', () => dadosOffline());
  ipcMain.handle('sync-data', () => sincronizar());
  ipcMain.on('set-igreja', (_e, id: unknown) => { if (Number.isInteger(id)) aoMudarIgreja(id as number); });
  ipcMain.on('offline:abrir-evento', (_e, id: unknown) => { if (Number.isInteger(id)) carregarEventoOffline(id as number); });
  ipcMain.on('offline:fechar-evento', () => definirEvento(null));
  ipcMain.on('culto:abrir-projecao', () => abrirProjecaoDoCulto());
  ipcMain.on('culto:voltar-online', () => voltarParaOnline());

  // Shared by controller, offline page and offline projection
  const comando = (_e: unknown, c: unknown) => { if (comandoValido(c)) executarComando(c); };
  ipcMain.on('culto:comando', comando);
  ipcMain.on('controller-command', comando);
  ipcMain.on('culto:pedir-estado', (e) => e.sender.send('estado-culto', estadoAtual()));
  ipcMain.on('culto:mensagem', (_e, texto: unknown) => {
    if (texto === null) enviarMensagem(null);
    else if (typeof texto === 'string' && texto.trim()) enviarMensagem(texto.trim().slice(0, 200));
  });
  ipcMain.on('controller-request-state', () => difundir());

  // LouvorJA (controller)
  ipcMain.handle('louvorja:tocar', (_e, texto: unknown, opcoes: unknown) => {
    if (typeof texto !== 'string' || !texto.trim()) return { estado: 'erro', mensagem: 'Este item não tem música.' };
    const o = (typeof opcoes === 'object' && opcoes) ? opcoes as { id?: unknown; escolher?: unknown } : {};
    return tocarNoLouvorJA(texto.slice(0, 200), {
      id: Number.isInteger(o.id) && (o.id as number) > 0 ? o.id as number : undefined,
      escolher: o.escolher === true,
    });
  });
  ipcMain.handle('louvorja:parar', () => pararLouvorJA());

  // Settings window
  ipcMain.handle('definicoes:obter', () => {
    const principal = screen.getPrimaryDisplay().id;
    const offline = ler('offlineData');
    return {
      pastaCultos: ler('pastaCultos') ?? '',
      ficheiroModelo: ler('ficheiroModelo') ?? '',
      projectionDisplayId: ler('projectionDisplayId') ?? null,
      ecras: screen.getAllDisplays().map((d, i) => ({
        id: d.id,
        nome: `Ecrã ${i + 1}: ${d.bounds.width}x${d.bounds.height}${d.id === principal ? ' (principal)' : ''}`,
      })),
      detetado: localizarPastas(),
      igreja: offline?.igreja ?? null,
      ultimaSincronizacao: offline?.lastSync ?? null,
      pendentes: contarPendentes(),
      versao: app.getVersion(),
      louvorjaEndereco: ler('louvorjaEndereco') ?? '',
      louvorjaToken: ler('louvorjaToken') ?? '',
    };
  });
  ipcMain.handle('definicoes:guardar', (_e, d: { pastaCultos?: string; ficheiroModelo?: string; projectionDisplayId?: number | null; louvorjaEndereco?: string; louvorjaToken?: string }) => {
    if ('pastaCultos' in d) gravar('pastaCultos', d.pastaCultos);
    if ('ficheiroModelo' in d) gravar('ficheiroModelo', d.ficheiroModelo);
    if ('projectionDisplayId' in d) gravar('projectionDisplayId', d.projectionDisplayId ?? undefined);
    if ('louvorjaEndereco' in d) gravar('louvorjaEndereco', String(d.louvorjaEndereco ?? '').trim());
    if ('louvorjaToken' in d) gravar('louvorjaToken', String(d.louvorjaToken ?? '').trim());
    atualizarUi();
    return true;
  });
  ipcMain.handle('definicoes:escolher-pasta', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win!, { title: 'Pasta "Cultos"', properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('definicoes:escolher-ficheiro', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win!, {
      title: 'Modelo do PowerPoint',
      properties: ['openFile'],
      filters: [{ name: 'PowerPoint', extensions: ['pptx', 'ppt', 'potx'] }],
    });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.on('definicoes:abrir-logs', () => shell.openPath(pastaLogs()));
  ipcMain.handle('definicoes:sincronizar', () => sincronizar());
  ipcMain.handle('definicoes:testar-louvorja', () => testarLouvorJA());
}

// ============================================
// App lifecycle
// ============================================

if (!tratarEventoSquirrel()) {
  // A second copy would fight over the projector — focus the first one instead.
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    app.on('second-instance', () => criarJanelaPrincipal());

    app.whenReady().then(async () => {
      iniciarLogger();
      try {
        await iniciarStore();
      } catch (err) {
        console.error('Falha ao iniciar a store:', err);
      }

      registarIpc();
      iniciarMenuETray();
      criarJanelaPrincipal();
      iniciarAtualizacoes();
      agendarSincronizacaoSilenciosa();

      screen.on('display-added', atualizarUi);
      screen.on('display-removed', () => {
        aoRemoverEcra();
        atualizarUi();
      });

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) criarJanelaPrincipal();
      });
    });

    app.on('before-quit', () => { ctx.aSair = true; });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') app.quit();
    });
  }
}
