import type { MusicaLouvorJA } from './louvorja';
import { AlteracaoPendente, DadosOffline, Limites } from './tipos';

export interface Guardado {
  /** Chosen projection screen. Kept even while that screen is unplugged. */
  projectionDisplayId?: number;
  /** "Cultos" folder chosen in Definições (otherwise auto-detected on external drives). */
  pastaCultos?: string;
  /** PowerPoint template chosen in Definições. */
  ficheiroModelo?: string;
  /** Church last opened in the web panel — the one kept offline. */
  lastIgrejaId?: number;
  janelas?: Record<string, Limites>;
  offlineData?: DadosOffline;
  /** Offline changes by dbEscalas id. */
  pendentes?: Record<string, AlteracaoPendente>;
  /** LouvorJA server ("127.0.0.1:7070" when empty). */
  louvorjaEndereco?: string;
  /** Only needed when LouvorJA runs on another computer. */
  louvorjaToken?: string;
  /** Song picked in LouvorJA for each liturgy "musica" text, so it opens straight away next time. */
  louvorjaEscolhas?: Record<string, MusicaLouvorJA>;
}

// electron-store is loaded lazily (see iniciarStore) — typed loosely on purpose.
let store: { get: (k: string) => unknown; set: (k: string, v: unknown) => void; delete: (k: string) => void; path: string } | null = null;

export async function iniciarStore() {
  const { default: Store } = await import('electron-store');
  store = new Store() as unknown as typeof store;
  console.log('Store:', store!.path);
}

export function ler<K extends keyof Guardado>(chave: K): Guardado[K] {
  return store?.get(chave) as Guardado[K];
}

export function gravar<K extends keyof Guardado>(chave: K, valor: Guardado[K] | null | undefined) {
  if (!store) return;
  if (valor === undefined || valor === null || valor === '') store.delete(chave);
  else store.set(chave, valor);
}
