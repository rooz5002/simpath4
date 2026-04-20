/**
 * useElectronUpdater — listens to electron-updater IPC events.
 *
 * Returns null when running in a plain browser (dev mode / non-Electron).
 * When running inside Electron, returns live update state.
 */
import { useEffect, useState } from 'react'

export type ElectronUpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'not-available' }
  | { status: 'available';   version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'ready';       version: string }
  | { status: 'error';       message: string }

// Type the window.simpath API (populated by preload.ts)
interface SimpathElectronApi {
  version:                  string
  onUpdateChecking:         (cb: () => void) => void
  onUpdateAvailable:        (cb: (info: { version: string }) => void) => void
  onUpdateNotAvailable:     (cb: () => void) => void
  onUpdateProgress:         (cb: (p: { percent: number }) => void) => void
  onUpdateDownloaded:       (cb: (info: { version: string }) => void) => void
  onUpdateError:            (cb: (msg: string) => void) => void
  installUpdate:            () => void
  removeAllUpdateListeners: () => void
}

declare global {
  interface Window { simpath?: SimpathElectronApi }
}

export function useElectronUpdater(): ElectronUpdateState | null {
  const api = window.simpath
  const [state, setState] = useState<ElectronUpdateState>({ status: 'idle' })

  useEffect(() => {
    if (!api) return  // running in plain browser

    api.onUpdateChecking    (()     => setState({ status: 'checking' }))
    api.onUpdateAvailable   ((info) => setState({ status: 'available',   version: info.version }))
    api.onUpdateNotAvailable(()     => setState({ status: 'not-available' }))
    api.onUpdateProgress    ((p)    => setState({ status: 'downloading', percent: Math.round(p.percent) }))
    api.onUpdateDownloaded  ((info) => setState({ status: 'ready',       version: info.version }))
    api.onUpdateError       ((msg)  => setState({ status: 'error',       message: msg }))

    return () => { api.removeAllUpdateListeners() }
  }, [api])

  if (!api) return null
  return state
}
