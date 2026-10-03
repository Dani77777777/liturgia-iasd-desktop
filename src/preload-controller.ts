import { contextBridge, ipcRenderer } from 'electron';
import type { EstadoCulto } from './tipos';

contextBridge.exposeInMainWorld('controllerAPI', {
  /** Navigation command for the main process. */
  sendCommand: (command: 'next' | 'previous') => {
    ipcRenderer.send('controller-command', command);
  },

  /** Message shown on the projection to the platform (null removes it). */
  enviarMensagem: (texto: string | null) => {
    ipcRenderer.send('culto:mensagem', texto);
  },

  /** Open the item's song in LouvorJA (id = song picked from the list). */
  tocarLouvorJA: (texto: string, opcoes?: { id?: number; escolher?: boolean }) =>
    ipcRenderer.invoke('louvorja:tocar', texto, opcoes),

  /** Close the song open in LouvorJA. */
  pararLouvorJA: () => ipcRenderer.invoke('louvorja:parar'),

  /** Ask the main process to push the current state. */
  requestState: () => {
    ipcRenderer.send('controller-request-state');
  },

  /** State updates pushed from the main process. */
  onStateUpdate: (callback: (state: EstadoCulto) => void) => {
    ipcRenderer.on('controller-state-update', (_event, state) => {
      callback(state);
    });
  }
});
