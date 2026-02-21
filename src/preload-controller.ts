import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('controllerAPI', {
  /**
   * Send a navigation command ('next' or 'previous') to main process
   */
  sendCommand: (command: 'next' | 'previous') => {
    ipcRenderer.send('controller-command', command);
  },

  /**
   * Request the current state from the main process
   */
  requestState: () => {
    ipcRenderer.send('controller-request-state');
  },

  /**
   * Listen for state updates pushed from the main process
   */
  onStateUpdate: (callback: (state: any) => void) => {
    ipcRenderer.on('controller-state-update', (_event, state) => {
      callback(state);
    });
  }
});
