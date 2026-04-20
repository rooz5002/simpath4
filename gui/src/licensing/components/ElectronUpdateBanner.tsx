/**
 * ElectronUpdateBanner — shown when electron-updater has an update.
 * Only renders when running inside Electron (window.simpath exists).
 * By Amir Ali Mokhtarzadeh 2025
 */
import { useElectronUpdater } from '../useElectronUpdater'

export function ElectronUpdateBanner() {
  const state = useElectronUpdater()
  if (!state) return null   // plain browser — nothing to show

  if (state.status === 'available') {
    return (
      <Banner colour="#1565c0">
        Update {state.version} available — downloading…
      </Banner>
    )
  }

  if (state.status === 'downloading') {
    return (
      <Banner colour="#1565c0">
        Downloading update… {state.percent}%
        <progress
          value={state.percent} max={100}
          style={{ marginLeft: 12, width: 120, verticalAlign: 'middle' }}
        />
      </Banner>
    )
  }

  if (state.status === 'ready') {
    return (
      <Banner colour="#2e7d32">
        Update {state.version} ready —&nbsp;
        <button
          onClick={() => window.simpath?.installUpdate()}
          style={{
            background: '#fff', color: '#2e7d32', border: 'none',
            borderRadius: 4, padding: '2px 10px', cursor: 'pointer',
            fontWeight: 700, fontSize: '0.8rem',
          }}
        >
          Restart &amp; install
        </button>
      </Banner>
    )
  }

  if (state.status === 'error') {
    return (
      <Banner colour="#b71c1c">
        Update error: {state.message}
      </Banner>
    )
  }

  return null
}

function Banner({ colour, children }: { colour: string; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1001,
      background: colour, color: '#fff',
      padding: '5px 16px', fontSize: '0.82rem',
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
    }}>
      {children}
    </div>
  )
}
