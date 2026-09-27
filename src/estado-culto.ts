import { POLL_MS } from './config';
import { atualizarUi, avisar, ctx, viva } from './contexto';
import { gravar, ler } from './store';
import { definirItemAtual, erroDeRede, supabase } from './supabase';
import { ComandoCulto, DadosOffline, EstadoCulto, Evento, ItemEscala, Participante } from './tipos';

/**
 * The service currently open in the panel and its schedule.
 * Online it mirrors Supabase (polled while someone needs it); offline it lives
 * in the local copy and every change is queued in `pendentes`.
 */
let evento: Evento | null = null;
let escala: ItemEscala[] = [];
/** Name of whoever holds each role of the open service (for items linked to a role). */
let nomesPorFuncao: Record<number, string> = {};
let semLigacao = false;
let poll: ReturnType<typeof setInterval> | null = null;

/** Bumped on every local change — a fetch that started before it is outdated and gets dropped. */
let versao = 0;
/** Online commands already shown on screen but not yet confirmed by Supabase. */
let aEnviar = 0;
/** Commands are sent one after the other, in the order they were pressed. */
let filaEnvio: Promise<void> = Promise.resolve();

export const eventoAtual = () => evento;

// ---------------------------------------------------------------------------
// Offline copy + pending changes
// ---------------------------------------------------------------------------

export function contarPendentes(): number {
  return Object.keys(ler('pendentes') || {}).length;
}

/** Offline data with the pending local changes applied on top. */
export function dadosOffline(): DadosOffline | null {
  const dados = ler('offlineData');
  if (!dados) return null;
  const pendentes = ler('pendentes') || {};
  return {
    ...dados,
    escalas: (dados.escalas || []).map(i => (pendentes[i.id] ? { ...i, ...pendentes[i.id] } : i)),
  };
}

function escalaOffline(eventoId: number): ItemEscala[] {
  return (dadosOffline()?.escalas || []).filter(i => i.evento_id === eventoId).sort((a, b) => a.ordem - b.ordem);
}

/**
 * Send offline changes to Supabase. Items leaving "atual" go first so the
 * "one item on air per event" rule is never broken.
 */
export async function enviarPendentes(): Promise<{ enviados: number; falhados: number }> {
  const pendentes = { ...(ler('pendentes') || {}) };
  const ids = Object.keys(pendentes).sort((a, b) => Number(pendentes[a].status === 'atual') - Number(pendentes[b].status === 'atual'));
  let enviados = 0;
  let falhados = 0;

  for (const id of ids) {
    const p = pendentes[id];
    try {
      if (p.status === 'atual') {
        const r = await supabase.from('dbEscalas').update({ status: 'concluido' }).eq('evento_id', p.evento_id).eq('status', 'atual').neq('id', Number(id));
        if (r.error) throw new Error(r.error.message);
      }
      const { error } = await supabase.from('dbEscalas').update({ status: p.status, hora_inicio: p.hora_inicio }).eq('id', Number(id));
      if (error) throw new Error(error.message);
      delete pendentes[id];
      enviados++;
    } catch (e) {
      console.error('Pendente não enviado', id, e);
      falhados++;
      if (erroDeRede(e)) break; // still offline — try again later
    }
  }

  gravar('pendentes', Object.keys(pendentes).length ? pendentes : null);
  if (enviados) console.log(`Enviadas ${enviados} alterações feitas offline.`);
  atualizarUi();
  return { enviados, falhados };
}

// ---------------------------------------------------------------------------
// People of each item (same rules as the website's lib/participantes.ts)
// ---------------------------------------------------------------------------

function participantesDoItem(item: ItemEscala, nomeMembro: (id?: number | null) => string | undefined): Participante[] {
  if (Array.isArray(item.participantes)) return item.participantes;
  if (item.pessoa_id || item.pessoa_nome) {
    return [{
      nome: item.membro?.nome ?? nomeMembro(item.pessoa_id) ?? item.pessoa_nome ?? null,
      substituto_id: item.substituto_id ?? null,
      substituto_nome: item.substituto?.nome ?? nomeMembro(item.substituto_id) ?? null,
    }];
  }
  return [];
}

function comPessoas(itens: ItemEscala[], nomeMembro: (id?: number | null) => string | undefined): ItemEscala[] {
  return itens.map(item => ({
    ...item,
    pessoas: participantesDoItem(item, nomeMembro)
      .map(p => {
        const nome = p.funcao_id ? nomesPorFuncao[p.funcao_id] : (p.substituto_id ? p.substituto_nome : p.nome);
        return nome ? (p.papel ? `${nome} (${p.papel})` : nome) : null;
      })
      .filter((n): n is string => !!n),
  }));
}

// ---------------------------------------------------------------------------
// Broadcasting
// ---------------------------------------------------------------------------

export function estadoAtual(): EstadoCulto {
  const dados = ctx.isOfflineMode ? dadosOffline() : null;
  return {
    evento,
    escala,
    eventTitle: evento?.titulo || '',
    offline: ctx.isOfflineMode,
    semLigacao,
    pendentes: contarPendentes(),
    config: dados?.config ?? ler('offlineData')?.config ?? null,
    membros: dados?.membros ?? [],
  };
}

/** Push the state to every window that shows it. */
export function difundir() {
  const estado = estadoAtual();
  for (const w of [ctx.controllerWindow, ctx.presentationWindow, ctx.mainWindow]) {
    if (viva(w)) w.webContents.send('estado-culto', estado);
  }
  if (viva(ctx.controllerWindow)) ctx.controllerWindow.webContents.send('controller-state-update', estado);
}

// ---------------------------------------------------------------------------
// Loading / syncing
// ---------------------------------------------------------------------------

async function carregarEscala() {
  if (!evento) {
    escala = [];
    return difundir();
  }
  if (ctx.isOfflineMode) {
    const dados = dadosOffline();
    const membros = new Map((dados?.membros || []).map(m => [m.id, m.nome]));
    const nomeMembro = (id?: number | null) => (id ? membros.get(id) : undefined);
    nomesPorFuncao = {};
    for (const c of (dados?.cargos || []).filter(c => c.evento_id === evento!.id)) {
      const nome = (c.substituto_id && nomeMembro(c.substituto_id)) || nomeMembro(c.pessoa_id) || c.pessoa_nome;
      if (nome) nomesPorFuncao[c.funcao_id] = nome;
    }
    escala = comPessoas(escalaOffline(evento.id), nomeMembro);
    semLigacao = false;
    return difundir();
  }

  // '*' so it works before and after the participants migration
  const eventoId = evento.id;
  const versaoInicial = versao;
  const [esc, car, ev] = await Promise.all([
    supabase.from('dbEscalas').select('*, membro:pessoa_id(nome), substituto:substituto_id(nome)').eq('evento_id', eventoId).order('ordem'),
    supabase.from('dbEventoCargos').select('funcao_id, pessoa_nome, substituto_id, membro:pessoa_id(nome), substituto:substituto_id(nome)').eq('evento_id', eventoId),
    supabase.from('dbEventos').select('*').eq('id', eventoId).maybeSingle(), // picks up messages sent from the website
  ]);
  // Something was pressed while this was loading (or is still being sent): this data is older than the screen.
  if (versaoInicial !== versao || aEnviar > 0 || evento?.id !== eventoId) return;
  if (ev.data) evento = ev.data;
  if (esc.error) {
    if (!semLigacao) console.warn('Controlo: sem ligação ao Supabase', esc.error.message);
    semLigacao = true;
  } else {
    nomesPorFuncao = {};
    type Cargo = { funcao_id: number; pessoa_nome: string | null; substituto_id: number | null; membro: { nome: string } | null; substituto: { nome: string } | null };
    for (const c of (car.data || []) as unknown as Cargo[]) {
      const nome = (c.substituto_id && c.substituto?.nome) || c.membro?.nome || c.pessoa_nome;
      if (nome) nomesPorFuncao[c.funcao_id] = nome;
    }
    escala = comPessoas(esc.data || [], () => undefined);
    semLigacao = false;
  }
  difundir();
}

/** (Re)start keeping the schedule fresh — only while a window needs it. */
export function garantirSync() {
  if (poll) clearInterval(poll);
  poll = null;
  carregarEscala();

  const precisa = viva(ctx.controllerWindow);
  if (evento && precisa && !ctx.isOfflineMode) {
    poll = setInterval(carregarEscala, POLL_MS);
  }
}

export async function definirEvento(novo: Evento | null) {
  evento = novo;
  escala = [];
  atualizarUi();
  garantirSync();
}

/** Called by the online panel when the URL points at an event. */
export async function carregarEventoOnline(id: number) {
  if (evento?.id === id) return;
  const { data, error } = await supabase.from('dbEventos').select('*').eq('id', id).single();
  if (error) {
    console.error('Erro ao obter o evento', id, error.message);
    return;
  }
  await definirEvento(data);
}

/** Called by the offline page when an event is opened there. */
export function carregarEventoOffline(id: number) {
  const ev = dadosOffline()?.eventos.find(e => e.id === id) ?? null;
  definirEvento(ev);
}

// ---------------------------------------------------------------------------
// Commands (controller window / offline page)
// ---------------------------------------------------------------------------

function alvo(comando: ComandoCulto): number | null | undefined {
  const atual = escala.findIndex(i => i.status === 'atual');
  const naoSeccao = (i: number) => escala[i] && escala[i].tipo !== 'seccao';

  if (comando === 'stop') return null;
  if (typeof comando === 'object') return comando.ir;
  if (comando === 'next') {
    for (let i = atual + 1; i < escala.length; i++) if (naoSeccao(i)) return escala[i].id;
    return atual === -1 ? undefined : null; // past the last item → finish
  }
  if (comando === 'previous') {
    if (atual === -1) return undefined;
    for (let i = atual - 1; i >= 0; i--) if (naoSeccao(i)) return escala[i].id;
    return null;
  }
  return undefined;
}

function aplicarOffline(comando: ComandoCulto) {
  if (!evento) return;
  const pendentes = { ...(ler('pendentes') || {}) };
  const agora = new Date().toISOString();
  const marcar = (i: ItemEscala, status: ItemEscala['status'], hora_inicio: string | null | undefined) => {
    i.status = status;
    i.hora_inicio = hora_inicio ?? null;
    pendentes[i.id] = { evento_id: i.evento_id, status: status ?? null, hora_inicio: i.hora_inicio };
  };

  if (comando === 'reset') {
    escala.forEach(i => marcar(i, null, null));
  } else {
    const destino = alvo(comando);
    if (destino === undefined) return;
    for (const i of escala) {
      if (i.id === destino) marcar(i, 'atual', agora);
      else if (i.status === 'atual') marcar(i, 'concluido', i.hora_inicio);
    }
  }

  gravar('pendentes', pendentes);
  escala = [...escala];
  difundir();
  atualizarUi();
}

let ultimoAvisoRede = 0;

export async function executarComando(comando: ComandoCulto) {
  if (!evento || escala.length === 0) return;

  if (ctx.isOfflineMode) return aplicarOffline(comando);

  if (comando === 'reset') return; // the web page has its own confirmation for this
  // Worked out from what is on screen (including presses not yet confirmed),
  // so two quick presses move two items instead of both landing on the same one.
  const destino = alvo(comando);
  if (destino === undefined) return;
  const eventoId = evento.id;

  // 1. Show it immediately
  const agora = new Date().toISOString();
  escala = escala.map(i =>
    i.id === destino ? { ...i, status: 'atual', hora_inicio: agora }
      : i.status === 'atual' ? { ...i, status: 'concluido' }
        : i);
  versao++;
  aEnviar++;
  difundir();

  // 2. Send it, after any earlier presses
  filaEnvio = filaEnvio.then(async () => {
    try {
      await definirItemAtual(eventoId, destino);
    } catch (e) {
      console.error('Erro ao mudar de item', e);
      if (erroDeRede(e) && Date.now() - ultimoAvisoRede > 30000) {
        ultimoAvisoRede = Date.now();
        avisar('Sem ligação à internet', 'Não foi possível mudar de item. Se a internet não voltar, use Liturgia › Mudar para modo offline.');
      }
    } finally {
      aEnviar--;
    }
    // 3. Once everything is sent, confirm against the database (also undoes a failed change)
    if (aEnviar === 0) await carregarEscala();
  });
  return filaEnvio;
}

/** Message from the sound desk to the platform, shown flashing on the projection. */
export async function enviarMensagem(texto: string | null) {
  if (!evento) return;
  evento = { ...evento, mensagem_projecao: texto };
  difundir();
  if (ctx.isOfflineMode) return; // the local projection already got it

  const { error } = await supabase.from('dbEventos').update({ mensagem_projecao: texto }).eq('id', evento.id);
  if (error) {
    console.error('Erro ao enviar mensagem:', error.message);
    avisar('Mensagem não enviada', erroDeRede(error) ? 'Sem ligação à internet.' : 'Falta executar a atualização da base de dados (migração de 27/09).');
  }
}

/** Offline data changed (new sync) — refresh the loaded service from it. */
export function aposSincronizar() {
  if (evento && ctx.isOfflineMode) carregarEscala();
}
