import { app, dialog, Menu, MenuItemConstructorOptions, nativeImage, screen, shell, Tray } from 'electron';
import * as path from 'path';
import { aoAtualizarUi, ctx, viva } from './contexto';
import { contarPendentes, enviarPendentes, eventoAtual } from './estado-culto';
import { abrirDefinicoes, abrirProjecaoDoCulto, alternarJanelaControlo, criarJanelaPrincipal, fecharProjecao, mudarParaOffline, voltarParaOnline } from './janelas';
import { pastaLogs } from './logger';
import { sincronizar } from './offline-sync';
import { abrirPastaDoDia, abrirPowerPoint } from './powerpoint';
import { gravar, ler } from './store';
import { reiniciarParaAtualizar, verificarAtualizacoesManual } from './updater';

let tray: Tray | null = null;

function dataCurta(data: string) {
  const [a, m, d] = data.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

function itensCulto(): MenuItemConstructorOptions[] {
  const ev = eventoAtual();
  if (!ev) return [];
  return [
    { label: `Abrir PowerPoint (${dataCurta(ev.data)})`, click: abrirPowerPoint },
    { label: 'Abrir pasta do dia', click: abrirPastaDoDia },
    { type: 'separator' },
    { label: viva(ctx.presentationWindow) ? 'Projeção aberta' : 'Abrir projeção', enabled: !viva(ctx.presentationWindow), click: abrirProjecaoDoCulto },
    { label: viva(ctx.controllerWindow) ? 'Fechar janela de controlo' : 'Abrir janela de controlo', click: alternarJanelaControlo },
  ];
}

function construirMenu() {
  const ecras = screen.getAllDisplays();
  const principalId = screen.getPrimaryDisplay().id;
  const ecraGuardado = ler('projectionDisplayId');
  const pendentes = contarPendentes();
  const igreja = ler('offlineData')?.igreja;

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Ficheiro',
      submenu: [
        { label: 'Definições…', accelerator: 'CmdOrCtrl+,', click: abrirDefinicoes },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    },
    ...(eventoAtual() ? [{ label: 'Culto', submenu: itensCulto() }] : []),
    {
      label: 'Projeção',
      submenu: [
        { label: 'Ecrã de projeção', enabled: false },
        ...ecras.map((d, i): MenuItemConstructorOptions => ({
          label: `Ecrã ${i + 1}: ${d.bounds.width}x${d.bounds.height}${d.id === principalId ? ' (principal)' : ''}`,
          type: 'radio',
          checked: ecraGuardado === d.id,
          click: () => { gravar('projectionDisplayId', d.id); construirMenu(); },
        })),
        ...(ecraGuardado !== undefined && !ecras.some(d => d.id === ecraGuardado)
          ? [{ label: '⚠ O ecrã escolhido não está ligado', enabled: false }]
          : []),
        { type: 'separator' },
        { label: 'Fechar projeção', enabled: viva(ctx.presentationWindow), click: fecharProjecao },
      ],
    },
    {
      label: 'Janela',
      submenu: [
        { label: 'Recarregar', role: 'reload' },
        { label: 'Ferramentas de programador', role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Liturgia',
      submenu: [
        { label: `Sincronizar para offline${igreja ? ` (${igreja})` : ''}`, click: () => sincronizar() },
        ...(pendentes > 0 && !ctx.isOfflineMode
          ? [{ label: `Enviar ${pendentes} alteração(ões) feitas offline`, click: () => enviarPendentes() }]
          : []),
        { type: 'separator' },
        ctx.isOfflineMode
          ? { label: 'Voltar a online', click: voltarParaOnline }
          : { label: 'Mudar para modo offline', click: mudarParaOffline },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        ...(ctx.atualizacaoPronta
          ? [{ label: `Reiniciar para atualizar (${ctx.atualizacaoPronta})`, click: reiniciarParaAtualizar }, { type: 'separator' as const }]
          : []),
        { label: 'Verificar atualizações', click: verificarAtualizacoesManual },
        { label: 'Abrir pasta de registos', click: () => shell.openPath(pastaLogs()) },
        { type: 'separator' },
        {
          label: 'Sobre',
          click: () => dialog.showMessageBox({
            type: 'info',
            title: 'Liturgia IASD Desktop',
            message: `Liturgia IASD Desktop\nVersão ${app.getVersion()}`,
            detail: `Electron ${process.versions.electron}`,
          }),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function construirTray() {
  if (!tray) {
    const img = nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png')).resize({ width: 16, height: 16 });
    tray = new Tray(img);
    tray.on('click', criarJanelaPrincipal);
  }

  const ev = eventoAtual();
  const estado = [
    ctx.isOfflineMode ? 'Modo offline' : null,
    viva(ctx.presentationWindow) ? 'A projetar' : null,
    ctx.atualizacaoPronta ? 'Atualização pronta' : null,
  ].filter(Boolean).join(' · ');
  tray.setToolTip(`Liturgia IASD${ev ? ` — ${ev.titulo}` : ''}${estado ? `\n${estado}` : ''}`);

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar painel', click: criarJanelaPrincipal },
    ...itensCulto(),
    { label: 'Fechar projeção', visible: viva(ctx.presentationWindow), click: fecharProjecao },
    { type: 'separator' },
    ...(ctx.atualizacaoPronta ? [{ label: 'Reiniciar para atualizar', click: reiniciarParaAtualizar }] : []),
    { label: 'Sair', click: () => { ctx.aSair = true; app.quit(); } },
  ]));
}

export function iniciarMenuETray() {
  aoAtualizarUi(construirMenu);
  aoAtualizarUi(construirTray);
  construirMenu();
  construirTray();
}
