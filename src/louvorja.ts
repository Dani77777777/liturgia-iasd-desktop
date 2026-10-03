import * as http from 'http';
import { gravar, ler } from './store';

// LouvorJA HTTP API (aba "Transmitir" › Conectar Servidor) — https://github.com/louvorja/desktop
// v2 (/api/v2/…) is in LouvorJA's source; released builds up to at least 26.11
// only have v1 (/api/…, all GET). We try v2 and fall back to v1 per address.
// The server also listens on 127.0.0.1, where a request without an Origin
// header needs no token. The token is only for a LouvorJA on another PC.

export const LOUVORJA_ENDERECO_PADRAO = '127.0.0.1:7070';

export interface MusicaLouvorJA { id: number; nome: string; album: string; }

export type RespostaLouvorJA =
  | { estado: 'a-tocar'; musica: MusicaLouvorJA; alternativas: MusicaLouvorJA[] }
  | { estado: 'escolher'; alternativas: MusicaLouvorJA[] }
  | { estado: 'parado' }
  | { estado: 'erro'; mensagem: string };

class ErroLouvorJA extends Error {
  /** LouvorJA's stable error code (e.g. NO_SONG_PLAYING), when it sent one. */
  constructor(mensagem: string, readonly codigo?: string) { super(mensagem); }
}
/** The server answered, but not with API v2. */
class SemApiV2 extends Error {}

interface Destino { host: string; porta: number; }
interface Chamada { rota: string; params?: Record<string, string | number>; metodo?: 'GET' | 'POST'; }

function destino(): Destino {
  let e = (ler('louvorjaEndereco') || LOUVORJA_ENDERECO_PADRAO).trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (/^\d+$/.test(e)) e = `127.0.0.1:${e}`;
  const [host, porta] = e.split(':');
  // LouvorJA binds IPv4 only — "localhost" could resolve to ::1 and be refused
  return { host: !host || host === 'localhost' ? '127.0.0.1' : host, porta: Number(porta) || 7070 };
}

function pedido({ host, porta }: Destino, versao: 1 | 2, c: Chamada, timeoutMs: number): Promise<any> {
  const token = ler('louvorjaToken');
  const params: Record<string, string | number> = { ...c.params };
  if (versao === 1 && token) params.token = token; // v1 only reads it from the URL
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

  return new Promise((resolve, reject) => {
    const req = http.request({
      host,
      port: porta,
      method: versao === 2 ? (c.metodo ?? 'GET') : 'GET',
      path: `${versao === 2 ? '/api/v2' : '/api'}/${c.rota}${query ? `?${query}` : ''}`,
      headers: versao === 2 && token ? { Authorization: `Bearer ${token}` } : {},
      timeout: timeoutMs,
    }, (res) => {
      let corpo = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { corpo += c; });
      res.on('end', () => {
        let json: any = null;
        try { json = JSON.parse(corpo); } catch { /* not JSON */ }
        // Every v2 answer names its "action"; an HTML page or a v1 answer means no v2
        if (versao === 2 && !(json && 'action' in json)) return reject(new SemApiV2());
        if (!json) return reject(new ErroLouvorJA('Esta versão do LouvorJA não tem a API. Atualize o LouvorJA para a versão 26.11 ou mais recente.'));
        if (res.statusCode === 200 && json.status === 'ok') return resolve(json);
        if (res.statusCode === 401) {
          return reject(new ErroLouvorJA(host === '127.0.0.1'
            ? 'O LouvorJA recusou o token. Apague o token nas Definições.'
            : `O LouvorJA recusou o token. Se o LouvorJA está neste computador, use o endereço 127.0.0.1:${porta} e deixe o token vazio.`));
        }
        if (res.statusCode === 503) return reject(new ErroLouvorJA('O LouvorJA não respondeu a tempo (há alguma janela aberta à espera?).'));
        reject(new ErroLouvorJA(json.message || `O LouvorJA respondeu com erro ${res.statusCode}.`, json.code));
      });
    });
    req.on('timeout', () => req.destroy(new ErroLouvorJA('O LouvorJA não respondeu a tempo.')));
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err instanceof ErroLouvorJA) return reject(err);
      if (err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH' || err.code === 'ETIMEDOUT') {
        return reject(new ErroLouvorJA('O LouvorJA não está a responder. Abra-o e, em Menu do Programa › Transmitir, clique em "Conectar Servidor".'));
      }
      if (err.code === 'ECONNRESET' || err.code?.startsWith('HPE_')) {
        // Something else answers on that port (AnyDesk also uses 7070 by default)
        return reject(new ErroLouvorJA(`Outro programa está a usar a porta ${porta}. Mude a porta no LouvorJA (Menu do Programa › Transmitir) e nas Definições.`));
      }
      reject(new ErroLouvorJA(`Falha a contactar o LouvorJA: ${err.message}`));
    });
    req.end();
  });
}

/** API version spoken at each address, once known. */
const versoes = new Map<string, 1 | 2>();

/** Call v2, or v1 when that server doesn't have v2. */
async function api(v2: Chamada, v1: Chamada, timeoutMs: number): Promise<any> {
  const d = destino();
  const k = `${d.host}:${d.porta}`;
  if (versoes.get(k) !== 1) {
    try {
      const r = await pedido(d, 2, v2, timeoutMs);
      versoes.set(k, 2);
      return r;
    } catch (e) {
      if (!(e instanceof SemApiV2)) throw e;
    }
  }
  const r = await pedido(d, 1, v1, timeoutMs);
  versoes.set(k, 1);
  return r;
}

// ---------------------------------------------------------------------------
// Finding the song
// ---------------------------------------------------------------------------

const normalizar = (s: string) => s.replace(/\(\s*hino\b[^)]*\)/gi, '') // LouvorJA 26.11: "Título (Hino nº 053)"
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/^\s*\d+\s*[-–—.:]?\s*/, '') // "053 - Título" → "título"
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** "53 - Que Diz a Bíblia" / "Hino 53" / "Que Diz a Bíblia" → number and title. */
function interpretar(texto: string): { numero?: number; titulo?: string } {
  const m = texto.trim().match(/^(?:hino\s*)?(\d{1,4})\s*(?:[-–—.:]\s*(.*))?$/i);
  if (m) return { numero: Number(m[1]), titulo: m[2]?.trim() || undefined };
  return { titulo: texto.trim() };
}

async function procurar(q: string): Promise<MusicaLouvorJA[]> {
  const r = await api({ rota: 'search-songs', params: { q } }, { rota: 'search-songs', params: { q } }, 8000);
  return Array.isArray(r.musicas) ? r.musicas : [];
}

/** Candidates best-first, and whether the first one is a sure match. */
async function candidatos(texto: string): Promise<{ lista: MusicaLouvorJA[]; certo: boolean }> {
  const { numero, titulo } = interpretar(texto);
  const tituloN = titulo ? normalizar(titulo) : '';

  // A number only finds hymnal tracks; the title finds everything else.
  // LouvorJA turns "*" into a SQL wildcard, so punctuation doesn't break the search.
  // One at a time: API v1 shares a single query object, so parallel searches clobber each other.
  const porNumero = numero ? await procurar(String(numero)) : [];
  const porTitulo = tituloN.length >= 2 ? await procurar(tituloN.split(' ').join('*')) : [];

  const doNumero = new Set(porNumero.map(m => m.id));
  const pontos = (m: MusicaLouvorJA) => {
    const nome = normalizar(m.nome);
    let p = 0;
    if (tituloN && nome === tituloN) p += 4;
    else if (tituloN && (nome.includes(tituloN) || tituloN.includes(nome))) p += 2;
    if (doNumero.has(m.id)) p += 1;
    return p;
  };

  const unicos = new Map<number, MusicaLouvorJA>();
  for (const m of [...porNumero, ...porTitulo]) unicos.set(m.id, m);
  const lista = [...unicos.values()]
    .map(m => ({ m, p: pontos(m) }))
    .filter(x => !tituloN || x.p > 0 || doNumero.size === 0)
    .sort((a, b) => b.p - a.p);

  const [primeiro, segundo] = lista;
  const certo = !!primeiro && (
    (tituloN ? primeiro.p >= 4 : true) && (!segundo || segundo.p < primeiro.p)
  );
  return { lista: lista.slice(0, 8).map(x => x.m), certo };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** Remembered-choice key: the whole text, number included, without accents/punctuation. */
const chave = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

async function abrir(musica: MusicaLouvorJA, texto: string, alternativas: MusicaLouvorJA[]): Promise<RespostaLouvorJA> {
  await api({ metodo: 'POST', rota: 'open-song', params: { id: musica.id } }, { rota: 'open-song', params: { id: musica.id } }, 20000);
  gravar('louvorjaEscolhas', { ...(ler('louvorjaEscolhas') || {}), [chave(texto)]: musica });
  return { estado: 'a-tocar', musica, alternativas };
}

/**
 * Play the song of a liturgy item ("53 - Que Diz a Bíblia").
 * - `id`: the operator picked this one from the list.
 * - `escolher`: show the list even if there is a remembered/sure match.
 */
export async function tocarNoLouvorJA(texto: string, opcoes: { id?: number; escolher?: boolean } = {}): Promise<RespostaLouvorJA> {
  try {
    if (opcoes.id) {
      const { lista } = await candidatos(texto).catch(() => ({ lista: [] as MusicaLouvorJA[] }));
      const musica = lista.find(m => m.id === opcoes.id) ?? { id: opcoes.id, nome: texto, album: '' };
      return await abrir(musica, texto, lista);
    }

    const lembrada = !opcoes.escolher ? ler('louvorjaEscolhas')?.[chave(texto)] : undefined;
    if (lembrada) return await abrir(lembrada, texto, []);

    const { lista, certo } = await candidatos(texto);
    if (lista.length === 0) return { estado: 'erro', mensagem: `Não encontrei "${texto}" no LouvorJA.` };
    if (certo && !opcoes.escolher) return await abrir(lista[0], texto, lista);
    return { estado: 'escolher', alternativas: lista };
  } catch (e) {
    console.error('LouvorJA:', e);
    return { estado: 'erro', mensagem: e instanceof ErroLouvorJA ? e.message : 'Falha a contactar o LouvorJA.' };
  }
}

export async function pararLouvorJA(): Promise<RespostaLouvorJA> {
  try {
    await api({ metodo: 'POST', rota: 'song-slides', params: { action: 'close' } }, { rota: 'song-slides', params: { action: 'close' } }, 8000);
    return { estado: 'parado' };
  } catch (e) {
    // Nothing playing (409) is fine — that's what "stop" wanted anyway
    if (e instanceof ErroLouvorJA && e.codigo === 'NO_SONG_PLAYING') return { estado: 'parado' };
    return { estado: 'erro', mensagem: e instanceof ErroLouvorJA ? e.message : 'Falha a contactar o LouvorJA.' };
  }
}

/** Used by Definições › "Testar ligação". */
export async function testarLouvorJA(): Promise<{ ok: boolean; mensagem: string }> {
  try {
    const r = await api({ rota: 'ping' }, { rota: 'ping' }, 4000);
    return { ok: true, mensagem: r.version ? `Ligado ao LouvorJA ${r.version}` : 'Ligado ao LouvorJA' };
  } catch (e) {
    return { ok: false, mensagem: e instanceof ErroLouvorJA ? e.message : 'Falha a contactar o LouvorJA.' };
  }
}
