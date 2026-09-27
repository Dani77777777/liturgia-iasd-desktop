import { autoUpdater, dialog } from 'electron';
import { AUTO_UPDATE_ENABLED, UPDATE_SERVER_URL } from './config';
import { atualizarUi, avisar, ctx, viva } from './contexto';

const INTERVALO = 4 * 60 * 60 * 1000;

/** Set while the user asked for a check from the menu — only then do we answer with dialogs. */
let verificacaoManual = false;
let avisoPendente = false;

function avisarAtualizacaoPronta() {
  // Never interrupt a projection — wait until it closes.
  if (viva(ctx.presentationWindow)) {
    avisoPendente = true;
    return;
  }
  avisoPendente = false;
  avisar('Atualização pronta', `A versão ${ctx.atualizacaoPronta} fica instalada da próxima vez que abrir o programa.`);
}

/** Call when the projection closes, to deliver a notice that was held back. */
export function aoFecharProjecao() {
  if (avisoPendente && ctx.atualizacaoPronta) avisarAtualizacaoPronta();
}

/**
 * Squirrel downloads updates in the background and applies them on the next
 * start, so there is no need to interrupt anyone: we only show a quiet
 * notification and a "Reiniciar para atualizar" menu item.
 */
export function iniciarAtualizacoes() {
  if (!AUTO_UPDATE_ENABLED) {
    console.log('Atualizações automáticas desativadas (modo dev ou não-Windows).');
    return;
  }

  autoUpdater.setFeedURL({ url: UPDATE_SERVER_URL });

  autoUpdater.on('update-available', () => {
    console.log('Atualização disponível — a transferir em segundo plano.');
    if (verificacaoManual) {
      verificacaoManual = false;
      dialog.showMessageBox({ type: 'info', title: 'Atualização disponível', message: 'Há uma nova versão. Está a ser transferida em segundo plano; será avisado quando estiver pronta.' });
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('A aplicação está atualizada.');
    if (verificacaoManual) {
      verificacaoManual = false;
      dialog.showMessageBox({ type: 'info', title: 'Atualizações', message: 'Já tem a versão mais recente.' });
    }
  });

  autoUpdater.on('update-downloaded', (_e, _notas, nome) => {
    console.log('Atualização transferida:', nome);
    ctx.atualizacaoPronta = nome || 'nova';
    atualizarUi();
    avisarAtualizacaoPronta();
  });

  autoUpdater.on('error', (erro) => {
    console.error('Erro nas atualizações:', erro);
    if (verificacaoManual) {
      verificacaoManual = false;
      dialog.showMessageBox({ type: 'warning', title: 'Atualizações', message: 'Não foi possível verificar se há atualizações.', detail: erro.message });
    }
  });

  setTimeout(() => autoUpdater.checkForUpdates(), 10000);
  setInterval(() => autoUpdater.checkForUpdates(), INTERVALO);
}

export function verificarAtualizacoesManual() {
  if (!AUTO_UPDATE_ENABLED) {
    dialog.showMessageBox({ type: 'info', title: 'Atualizações', message: 'As atualizações automáticas só existem na versão instalada para Windows.' });
    return;
  }
  if (ctx.atualizacaoPronta) {
    dialog.showMessageBox({ type: 'info', title: 'Atualizações', message: `A versão ${ctx.atualizacaoPronta} já foi transferida. Reinicie o programa para a usar.` });
    return;
  }
  verificacaoManual = true;
  autoUpdater.checkForUpdates();
}

export function reiniciarParaAtualizar() {
  ctx.aSair = true;
  autoUpdater.quitAndInstall();
}
