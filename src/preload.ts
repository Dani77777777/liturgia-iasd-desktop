import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    getOfflineData: () => ipcRenderer.invoke('get-offline-data'),
    syncData: () => ipcRenderer.invoke('sync-data'),
    onSyncStatus: (callback: (status: string) => void) => ipcRenderer.on('sync-status', (_event, value) => callback(value))
});
