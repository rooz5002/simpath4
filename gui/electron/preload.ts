import { contextBridge, ipcRenderer } from 'electron'

/**
 * Exposes a safe, typed API to the renderer (React app).
 * Renderer cannot access Node.js or Electron internals directly.
 */
contextBridge.exposeInMainWorld('simpath', {
  version: '0.1.0',

  // ── Auto-updater events ───────────────────────────────────────────────────
  onUpdateChecking:    (cb: () => void) =>
    ipcRenderer.on('update:checking',     () => cb()),

  onUpdateAvailable:   (cb: (info: unknown) => void) =>
    ipcRenderer.on('update:available',    (_e, info) => cb(info)),

  onUpdateNotAvailable:(cb: () => void) =>
    ipcRenderer.on('update:not-available',() => cb()),

  onUpdateProgress:    (cb: (p: unknown) => void) =>
    ipcRenderer.on('update:progress',     (_e, p) => cb(p)),

  onUpdateDownloaded:  (cb: (info: unknown) => void) =>
    ipcRenderer.on('update:downloaded',   (_e, info) => cb(info)),

  onUpdateError:       (cb: (msg: string) => void) =>
    ipcRenderer.on('update:error',        (_e, msg) => cb(msg)),

  installUpdate: () => ipcRenderer.send('update:install'),


  removeAllUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update:checking')
    ipcRenderer.removeAllListeners('update:available')
    ipcRenderer.removeAllListeners('update:not-available')
    ipcRenderer.removeAllListeners('update:progress')
    ipcRenderer.removeAllListeners('update:downloaded')
    ipcRenderer.removeAllListeners('update:error')
  },
})
