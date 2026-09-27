export type TipoItem = 'musica' | 'responsabilidade' | 'fixo' | 'seccao';
export type EstadoItem = 'pendente' | 'atual' | 'concluido' | null;

export interface Evento {
  id: number;
  igreja_id: number;
  data: string; // timestamptz at 00:00 UTC
  titulo: string | null;
  hora?: string | null;
  mensagem_projecao?: string | null;
}

export interface ItemEscala {
  id: number;
  evento_id: number;
  ordem: number;
  titulo: string;
  tipo: TipoItem;
  status?: EstadoItem;
  musica?: string | null;
  observacoes?: string | null;
  pessoa_id?: number | null;
  pessoa_nome?: string | null;
  substituto_id?: number | null;
  hora_inicio?: string | null;
  hora_fim_fixa?: string | null;
  duracao?: number | null;
  /** JSON list (2026-09-28 migration) — see the website's lib/participantes.ts. */
  participantes?: Participante[] | null;
  /** Joined on online fetches (old single-person columns). */
  membro?: { nome: string } | null;
  substituto?: { nome: string } | null;
  /** Resolved display names, filled in by the main process before broadcasting. */
  pessoas?: string[];
}

export interface Participante {
  pessoa_id?: number | null;
  nome?: string | null;
  funcao_id?: number | null;
  substituto_id?: number | null;
  substituto_nome?: string | null;
  papel?: string | null;
}

export interface LiturgiaConfig {
  logo_url: string | null;
  cor_fundo: string;
  cor_texto: string;
  cor_destaque: string;
  mostrar_relogio: boolean;
  mostrar_seguinte: boolean;
  mensagem_espera: string | null;
}

export interface DadosOffline {
  lastSync: string;
  igrejaId: number;
  igreja: string | null;
  eventos: Evento[];
  membros: { id: number; nome: string }[];
  funcoes: { id: number; nome: string; cor: string }[];
  escalas: ItemEscala[];
  cargos: { id: number; evento_id: number; funcao_id: number; pessoa_id?: number | null; pessoa_nome?: string | null; substituto_id?: number | null }[];
  config: LiturgiaConfig | null;
}

/** Change made while offline, waiting to be sent to Supabase. */
export interface AlteracaoPendente {
  evento_id: number;
  status: EstadoItem;
  hora_inicio: string | null;
}

export type ComandoCulto =
  | 'next'
  | 'previous'
  | 'stop'
  | 'reset'
  | { ir: number };

/** State pushed to the controller, the offline page and the offline projection. */
export interface EstadoCulto {
  evento: Evento | null;
  escala: ItemEscala[];
  eventTitle: string;
  offline: boolean;
  semLigacao: boolean;
  pendentes: number;
  config: LiturgiaConfig | null;
  membros: { id: number; nome: string }[];
}

export interface Limites {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized?: boolean;
}
