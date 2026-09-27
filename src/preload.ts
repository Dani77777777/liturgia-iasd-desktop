// Main window: loaded with the web panel (online) and with offline/index.html.
// Sandboxed preload — only `electron` can be required here.
import { contextBridge, ipcRenderer } from 'electron';
import type { ComandoCulto, EstadoCulto } from './tipos';

contextBridge.exposeInMainWorld('electron', {
    getOfflineData: () => ipcRenderer.invoke('get-offline-data'),
    syncData: () => ipcRenderer.invoke('sync-data'),
    onSyncStatus: (callback: (status: string) => void) => ipcRenderer.on('sync-status', (_event, value) => callback(value)),

    /** Called by the website whenever the church is chosen, so the offline copy follows it. */
    setIgreja: (igrejaId: number) => ipcRenderer.send('set-igreja', igrejaId),

    // Offline page: open a service and control it locally
    abrirEvento: (id: number) => ipcRenderer.send('offline:abrir-evento', id),
    fecharEvento: () => ipcRenderer.send('offline:fechar-evento'),
    comando: (c: ComandoCulto) => ipcRenderer.send('culto:comando', c),
    pedirEstado: () => ipcRenderer.send('culto:pedir-estado'),
    onEstado: (callback: (estado: EstadoCulto) => void) => ipcRenderer.on('estado-culto', (_event, estado) => callback(estado)),
    abrirProjecao: () => ipcRenderer.send('culto:abrir-projecao'),
    voltarOnline: () => ipcRenderer.send('culto:voltar-online'),
});
