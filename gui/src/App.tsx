import { useEffect, useRef, useState } from 'react'
import { MapCanvas }      from './canvas/MapCanvas'
import { MapCanvas3D, type MapCanvas3DHandle } from './canvas/MapCanvas3D'
import { ControlPanel }   from './panels/ControlPanel'
import { AlgorithmPanel } from './panels/AlgorithmPanel'
import { PluginPanel }    from './panels/PluginPanel'
import { Panel3D }        from './panels/Panel3D'
import { useSimStore }    from './api/stateStore'
import { engineApi }      from './api/engineApi'
import { engineApi3D }    from './api/engineApi3D'

import { UpdateChecker }         from './licensing/UpdateChecker'
import { LicenseDialog }         from './licensing/components/LicenseDialog'
import { UpdateBanner }          from './licensing/components/UpdateBanner'
import { ElectronUpdateBanner }  from './licensing/components/ElectronUpdateBanner'
import type { LicenseStatus } from './api/engineApi'
import type { UpdateStatus }  from './licensing/UpdateChecker'

// ── Configuration ─────────────────────────────────────────────────────────────
const APP_VERSION         = '0.1.0'
const UPDATE_MANIFEST_URL = 'https://www.roboticser.com/simpath/version.json'

const updateChecker = new UpdateChecker(APP_VERSION, UPDATE_MANIFEST_URL, 'simpath4')

type AppMode = '2D' | '3D'

export default function App() {
  const connect = useSimStore(s => s.connect)

  const [mode,          setMode]          = useState<AppMode>('2D')
  const [license,       setLicense]       = useState<LicenseStatus | null>(null)
  const [updateStatus,  setUpdateStatus]  = useState<UpdateStatus  | null>(null)
  const [showLicDialog, setShowLicDialog] = useState(false)

  // ── 3D state ─────────────────────────────────────────────────────────────
  const [conn3D,   setConn3D]   = useState(false)
  const [algos3D,  setAlgos3D]  = useState<string[]>([])
  const [status3D, setStatus3D] = useState('Disconnected')
  const xs3D = 15, ys3D = 15, zs3D = 8
  const [start3D] = useState<[number,number,number]>([0,0,0])
  const [goal3D]  = useState<[number,number,number]>([14,14,7])
  const canvas3DRef = useRef<MapCanvas3DHandle>(null)

  // ── 2D init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    connect()
    updateChecker.check().then(setUpdateStatus).catch(() => {})
  }, [connect])

  const connected2D = useSimStore(s => s.connected)
  useEffect(() => {
    if (!connected2D) return
    engineApi.getLicense().then(setLicense).catch(() => {})
  }, [connected2D])

  // ── 3D connect / disconnect ───────────────────────────────────────────────
  useEffect(() => {
    if (mode !== '3D') {
      engineApi3D.disconnect()
      setConn3D(false)
      setStatus3D('Disconnected')
      return
    }

    setStatus3D('Connecting…')
    engineApi3D.connect(
      async () => {
        setConn3D(true)
        setStatus3D('Connected')
        try {
          const algos = await engineApi3D.listAlgorithms()
          setAlgos3D(algos)
        } catch { /* no algorithms available */ }
        try {
          await engineApi3D.setGrid(xs3D, ys3D, zs3D)
          canvas3DRef.current?.refreshGrid()
        } catch { /* 3D grid not supported by current engine */ }
        setStatus3D('Ready')
      },
      () => { setConn3D(false); setStatus3D('Disconnected') },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const tier = license?.tier ?? '…'

  function switchMode(m: AppMode) {
    if (m === mode) return
    setMode(m)
  }

  return (
    <>
      <UpdateBanner status={updateStatus} />
      <ElectronUpdateBanner />

      <div className="app-layout">
        <header className="app-header">
          <span className="logo">SIMPATH <strong>4</strong></span>
          <span className="subtitle">Path Planning Simulation</span>

          {/* Mode toggle */}
          <div className="mode-toggle">
            <button
              className={mode === '2D' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => switchMode('2D')}
            >2D</button>
            <button
              className={mode === '3D' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => switchMode('3D')}
            >3D</button>
          </div>

          <div className="header-right">
            <button
              className="license-badge"
              data-tier={license?.tier ?? 'TRIAL'}
              onClick={() => setShowLicDialog(true)}
              title={license?.message ?? 'Click to manage license'}
            >
              {tier}
            </button>

            <span
              className="update-status"
              title={updateStatus?.message ?? 'Checking for updates…'}
            >
              {updateStatus === null
                ? '⟳'
                : updateStatus.message.startsWith('Could not')
                  ? '⚠ offline'
                  : updateStatus.updateAvailable
                    ? '↑ update'
                    : '✓ up to date'}
            </span>

            <span className="version">v{APP_VERSION}</span>
          </div>
        </header>

        {/* ── 2D layout ────────────────────────────────────────────────────── */}
        {mode === '2D' && (
          <>
            <aside className="sidebar">
              <ControlPanel />
              <AlgorithmPanel />
              <PluginPanel />
              <div className="sidebar-footer">
                <span>© 2025 Amir Ali Mokhtarzadeh</span>
                <span>SIMPATH 4</span>
              </div>
            </aside>
            <main className="canvas-area">
              <MapCanvas />
            </main>
          </>
        )}

        {/* ── 3D layout ────────────────────────────────────────────────────── */}
        {mode === '3D' && (
          <>
            <aside className="sidebar">
              <Panel3D
                connected={conn3D}
                algorithms={algos3D}
                status={status3D}
                onStatusChange={setStatus3D}
                onGridChanged={async () => {
                  canvas3DRef.current?.refreshGrid()
                }}
                onPathFound={(path, _ms) => {
                  canvas3DRef.current?.setPath(path)
                }}
                onPathClear={() => {
                  canvas3DRef.current?.setPath([])
                }}
                onAlgosChanged={setAlgos3D}
              />
              <div className="sidebar-footer">
                <span>© 2025 Amir Ali Mokhtarzadeh</span>
                <span>SIMPATH 4 — 3D</span>
              </div>
            </aside>
            <main className="canvas-area canvas-area-3d">
              <MapCanvas3D
                ref={canvas3DRef}
                xs={xs3D} ys={ys3D} zs={zs3D}
                start={start3D}
                goal={goal3D}
              />
            </main>
          </>
        )}
      </div>

      {showLicDialog && (
        <LicenseDialog
          current={license}
          onActivated={result => { setLicense(result); setShowLicDialog(false) }}
          onClose={() => setShowLicDialog(false)}
        />
      )}
    </>
  )
}
