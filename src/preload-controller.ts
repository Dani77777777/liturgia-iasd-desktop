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
