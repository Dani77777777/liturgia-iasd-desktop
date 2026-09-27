import { dialog } from 'electron';
import * as https from 'https';
import { DIAS_HISTORICO_OFFLINE } from './config';
import { atualizarUi, ctx, viva } from './contexto';
import { aposSincronizar, contarPendentes, enviarPendentes } from './estado-culto';
import { gravar, ler } from './store';
import { buscarTudo, supabase } from './supabase';
import { DadosOffline, Evento, ItemEscala } from './tipos';

let aSincronizar = false;

function enviarEstado(msg: string) {
  if (viva(ctx.mainWindow)) ctx.mainWindow.webContents.send('sync-status', msg);
}

/**
 * Download the last opened church (only that one) for offline use.
 * Pending offline changes are sent first so they are never overwritten.
 */
export async function sincronizar(silencioso = false): Promise<{ success: boolean; error?: string }> {
  if (aSincronizar) return { success: false, error: 'Já existe uma sincronização a decorrer.' };
  const igrejaId = ler('lastIgrejaId');
  if (!igrejaId) {
    const error = 'Ainda não se sabe qual é a igreja. Abra o painel online e escolha a igreja primeiro.';
    if (!silencioso) dialog.showMessageBox({ type: 'info', title: 'Sincronização', message: error });
    return { success: false, error };
  }

  aSincronizar = true;
  try {
    if (contarPendentes() > 0) await enviarPendentes();

    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_HISTORICO_OFFLINE);
    const desdeISO = desde.toISOString().slice(0, 10);

    const eventos = await buscarTudo<Evento>((de, ate) =>
      supabase.from('dbEventos').select('*').eq('igreja_id', igrejaId).gte('data', desdeISO).order('data').range(de, ate));
    const ids = eventos.map(e => e.id);

    const [membros, funcoes, igreja] = await Promise.all([
      buscarTudo<{ id: number; nome: string }>((de, ate) => supabase.from('dbMembros').select('id, nome').eq('id_igreja', igrejaId).order('nome').range(de, ate)),
      buscarTudo<{ id: number; nome: string; cor: string }>((de, ate) => supabase.from('dbFuncoes').select('id, nome, cor').eq('igreja_id', igrejaId).range(de, ate)),
      supabase.from('dbIgrejas').select('local').eq('id', igrejaId).maybeSingle(),
    ]);

    const escalas = ids.length
      ? await buscarTudo<ItemEscala>((de, ate) => supabase.from('dbEscalas').select('*').in('evento_id', ids).order('id').range(de, ate))
      : [];
    const cargos = ids.length
      ? await buscarTudo<DadosOffline['cargos'][number]>((de, ate) => supabase.from('dbEventoCargos').select('*').in('evento_id', ids).order('id').range(de, ate))
      : [];

    // Optional (only exists after the 2026-09-27 migration)
    const { data: config } = await supabase.from('dbLiturgiaConfig').select('*').eq('igreja_id', igrejaId).maybeSingle();

    const dados: DadosOffline = {
      lastSync: new Date().toISOString(),
      igrejaId,
      igreja: igreja.data?.local ?? null,
      eventos,
      membros,
      funcoes,
      escalas,
      cargos,
      config: config ?? null,
    };
    gravar('offlineData', dados);
    console.log(`Sincronização: ${eventos.length} cultos, ${escalas.length} itens (igreja ${igrejaId}).`);

    aposSincronizar();
    atualizarUi();
    if (!silencioso) {
      enviarEstado('Sincronização concluída com sucesso!');
      dialog.showMessageBox({
        type: 'info',
        title: 'Sincronização',
        message: `Dados de ${dados.igreja ?? 'igreja'} guardados para uso offline.`,
        detail: `${eventos.length} cultos (desde há ${DIAS_HISTORICO_OFFLINE} dias).`,
      });
    }
    return { success: true };
  } catch (err) {
    const msg = (err as Error).message;
    console.error('Erro de sincronização:', msg);
    if (!silencioso) {
      enviarEstado(`Erro: ${msg}`);
      dialog.showErrorBox('Erro de sincronização', `Não foi possível descarregar os dados: ${msg}`);
    }
    return { success: false, error: msg };
  } finally {
    aSincronizar = false;
  }
}

/** Quick connectivity check against Supabase. */
export function temInternet(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request({ host: 'supabase.com', method: 'HEAD', timeout: 4000 }, () => resolve(true));
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

/** On startup: if online, send pending changes and refresh the offline copy silently. */
export function agendarSincronizacaoSilenciosa() {
  setTimeout(async () => {
    if (!(await temInternet())) {
      console.log('Auto-sync: offline, a saltar.');
      return;
    }
    sincronizar(true);
  }, 5000);
}

/** When the church changes in the panel, keep the offline copy for the new one. */
export function aoMudarIgreja(igrejaId: number) {
  if (!igrejaId || ler('lastIgrejaId') === igrejaId) return;
  gravar('lastIgrejaId', igrejaId);
  console.log('Igreja escolhida no painel:', igrejaId);
  if (ler('offlineData')?.igrejaId !== igrejaId) sincronizar(true);
}
