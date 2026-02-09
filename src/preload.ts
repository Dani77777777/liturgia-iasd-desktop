import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    // Methods to be exposed to the valid renderer (web app)
    // sendMessage: (message: string) => ipcRenderer.send('message', message)
});
