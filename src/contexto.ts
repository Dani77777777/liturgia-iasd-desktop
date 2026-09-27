import { BrowserWindow, Notification } from 'electron';

/** Mutable app-wide state shared by the modules. */
export const ctx = {
  mainWindow: null as BrowserWindow | null,
  presentationWindow: null as BrowserWindow | null,
  controllerWindow: null as BrowserWindow | null,
  settingsWindow: null as BrowserWindow | null,
  isOfflineMode: false,
  /** Version name of an update already downloaded (installed on next start). */
  atualizacaoPronta: null as string | null,
  aSair: false,
};

export const viva = (w: BrowserWindow | null): w is BrowserWindow => !!w && !w.isDestroyed();

// Menu and tray register here so other modules can refresh them without circular imports.
const ouvintes: (() => void)[] = [];
export function aoAtualizarUi(fn: () => void) { ouvintes.push(fn); }
export function atualizarUi() { ouvintes.forEach(fn => fn()); }

/** Non-blocking system notification (never a modal during a service). */
export function avisar(titulo: string, corpo: string) {
  console.log(`[aviso] ${titulo}: ${corpo}`);
  if (Notification.isSupported()) new Notification({ title: titulo, body: corpo, silent: true }).show();
}
