import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGINA = 1000; // PostgREST returns at most 1000 rows per request

/** Fetch every row, page by page (a plain select silently stops at 1000). */
export async function buscarTudo<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const todos: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    todos.push(...(data || []));
    if (!data || data.length < PAGINA) return todos;
  }
}

/**
 * Put `itemId` on air (null = stop). Uses the atomic RPC from the
 * 2026-09-27 migration and falls back to two updates if it isn't there yet.
 */
export async function definirItemAtual(eventoId: number, itemId: number | null) {
  const { error } = await supabase.rpc('definir_item_atual', { p_evento_id: eventoId, p_item_id: itemId });
  if (!error) return;
  if (error.code !== 'PGRST202') throw new Error(error.message);

  const r1 = await supabase.from('dbEscalas').update({ status: 'concluido' }).eq('evento_id', eventoId).eq('status', 'atual');
  if (r1.error) throw new Error(r1.error.message);
  if (itemId) {
    const r2 = await supabase.from('dbEscalas').update({ status: 'atual', hora_inicio: new Date().toISOString() }).eq('id', itemId);
    if (r2.error) throw new Error(r2.error.message);
  }
}

/** True for "no internet" style failures (as opposed to database errors). */
export function erroDeRede(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e).toLowerCase();
  return ['fetch failed', 'failed to fetch', 'network', 'enotfound', 'econnrefused', 'etimedout', 'eai_again', 'socket'].some(s => msg.includes(s));
}
