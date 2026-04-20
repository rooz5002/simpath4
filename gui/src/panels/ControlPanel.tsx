import { useState, useRef } from 'react'
import { useSimStore } from '../api/stateStore'
import { MapCanvas } from '../canvas/MapCanvas'

export function ControlPanel() {
  const {
    rows, cols,
    connected, status, noPathError,
    start, goal,
    brushShape, brushRadius,
    runPathFind, clearPath, resetGrid, setGridSize,
    saveWorkspace, loadWorkspace,
    setBrushShape, setBrushRadius,
  } = useSimStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [inputRows, setInputRows] = useState(String(rows))
  const [inputCols, setInputCols] = useState(String(cols))

  function applyGridSize() {
    const r = Math.max(2, Math.min(100, parseInt(inputRows) || rows))
    const c = Math.max(2, Math.min(100, parseInt(inputCols) || cols))
    setGridSize(r, c)
  }

  function handleSetStart() {
    const setter = (MapCanvas as { setMode?: (m: string) => void }).setMode
    if (setter) setter('start')
  }
  function handleSetGoal() {
    const setter = (MapCanvas as { setMode?: (m: string) => void }).setMode
    if (setter) setter('goal')
  }

  return (
    <div className="panel control-panel">
      <h3>Controls</h3>

      {/* Connection status */}
      <div className={`status-dot ${connected ? 'ok' : 'err'}`} />
      <span className="status-text">{status}</span>

      {/* Grid size */}
      <fieldset>
        <legend>Grid size</legend>
        <input
          type="number" min="2" max="100"
          value={inputRows}
          onChange={e => setInputRows(e.target.value)}
        />
        <span> × </span>
        <input
          type="number" min="2" max="100"
          value={inputCols}
          onChange={e => setInputCols(e.target.value)}
        />
        <button onClick={applyGridSize}>Apply</button>
      </fieldset>

      {/* Interaction mode */}
      <fieldset>
        <legend>Place</legend>
        <button onClick={handleSetStart}>
          Set Start {start ? `(${start[0]},${start[1]})` : ''}
        </button>
        <button onClick={handleSetGoal}>
          Set Goal {goal ? `(${goal[0]},${goal[1]})` : ''}
        </button>
        <small>Click/drag canvas to toggle obstacles</small>
      </fieldset>

      {/* Brush */}
      <fieldset>
        <legend>Brush</legend>
        <label className="coord-label">
          Shape
          <select
            value={brushShape}
            onChange={e => setBrushShape(e.target.value as 'square' | 'circle')}
            style={{ width: 'auto', marginLeft: 6, padding: '2px 4px' }}
          >
            <option value="square">Square</option>
            <option value="circle">Circle</option>
          </select>
        </label>
        <label className="coord-label" style={{ marginTop: 4 }}>
          Radius
          <input
            type="number" min={1} max={10} value={brushRadius}
            style={{ width: 52, marginLeft: 6 }}
            onChange={e => setBrushRadius(parseInt(e.target.value) || 1)}
          />
        </label>
      </fieldset>

      {/* Actions */}
      <div className="actions">
        <button
          className="btn-primary"
          onClick={() => runPathFind()}
          disabled={!connected || !start || !goal}
        >
          Find Path
        </button>
        <button onClick={clearPath}>Clear Path</button>
        <button onClick={resetGrid}>Reset Grid</button>
      </div>

      {/* No-path error banner */}
      {noPathError && (
        <div className="no-path-banner" onClick={clearPath}>
          ✕&nbsp; There is no path to the Goal
        </div>
      )}

      {/* Workspace */}
      <fieldset>
        <legend>Workspace</legend>
        <button onClick={saveWorkspace}>Save</button>
        <button onClick={() => fileInputRef.current?.click()}>Load</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".simpath,application/json"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) loadWorkspace(f).catch(err => alert(String(err)))
            e.target.value = ''
          }}
        />
      </fieldset>
    </div>
  )
}
