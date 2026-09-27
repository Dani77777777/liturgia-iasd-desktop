import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('definicoes', {
  obter: () => ipcRenderer.invoke('definicoes:obter'),
  guardar: (d: Record<string, unknown>) => ipcRenderer.invoke('definicoes:guardar', d),
  escolherPasta: () => ipcRenderer.invoke('definicoes:escolher-pasta'),
  escolherFicheiro: () => ipcRenderer.invoke('definicoes:escolher-ficheiro'),
  abrirLogs: () => ipcRenderer.send('definicoes:abrir-logs'),
  sincronizar: () => ipcRenderer.invoke('definicoes:sincronizar'),
});
