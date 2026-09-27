// Projection window. The web projection ignores this; offline/present.html uses it.
import { contextBridge, ipcRenderer } from 'electron';
import type { EstadoCulto } from './tipos';

contextBridge.exposeInMainWorld('projecao', {
  pedirEstado: () => ipcRenderer.send('culto:pedir-estado'),
  onEstado: (callback: (estado: EstadoCulto) => void) => ipcRenderer.on('estado-culto', (_event, estado) => callback(estado)),
});
