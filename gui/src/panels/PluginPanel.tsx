import { useRef, useState } from 'react'
import { engineApi } from '../api/engineApi'
import { useSimStore } from '../api/stateStore'
import type { AlgorithmInfo } from '../types/SimState'

// ── Plugin validation (text-based, no execution) ────────────────────────────

interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

function validatePlugin(filename: string, content: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!filename.endsWith('.py'))
    errors.push('File must have a .py extension.')

  if (!content.trim())
    errors.push('File is empty.')

  if (!/^def find_path\s*\(/m.test(content))
    errors.push('Missing required function: def find_path(grid, start, goal)')

  if (!/^MAP_TYPE\s*=/m.test(content))
    warnings.push('MAP_TYPE not declared — will default to GRID.')

  const validTypes = ['GRID','GRAPH','SAMPLING','POTENTIAL_FIELD','TRAJECTORY','AGENT']
  const mtMatch = content.match(/^MAP_TYPE\s*=\s*["'](\w+)["']/m)
  if (mtMatch && !validTypes.includes(mtMatch[1]))
    warnings.push(`Unknown MAP_TYPE "${mtMatch[1]}". Valid values: ${validTypes.join(', ')}.`)

  if (/^import\s+os\b|^from\s+os\b|subprocess|shutil\.rmtree|open\s*\(/m.test(content))
    warnings.push('Plugin uses filesystem/OS operations — review for safety.')

  if (/^find_path\s*=\s*/m.test(content) && !/^def find_path\s*\(/m.test(content))
    errors.push('find_path appears to be reassigned, not defined as a function.')

  return { ok: errors.length === 0, errors, warnings }
}

// ── Help modal ───────────────────────────────────────────────────────────────

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal plugin-help-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Plugin Authoring Guide</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body plugin-help-body">

          <h4>Required</h4>
          <pre>{`MAP_TYPE = "GRID"   # declares map representation

def find_path(grid, start, goal):
    ...
    return path`}</pre>

          <h4>Parameters</h4>
          <table className="help-table">
            <tbody>
              <tr><td><code>grid</code></td><td>2-D list <code>grid[row][col]</code> — <code>0</code> = free, <code>1</code> = obstacle</td></tr>
              <tr><td><code>start</code></td><td><code>(row, col)</code> tuple — start position</td></tr>
              <tr><td><code>goal</code></td><td><code>(row, col)</code> tuple — goal position</td></tr>
            </tbody>
          </table>

          <h4>Return value</h4>
          <p>Plain list of points:</p>
          <pre>{`return [(r0,c0), (r1,c1), ...]`}</pre>
          <p>Or rich dict with visualisation data:</p>
          <pre>{`return {
    "path": [(r0,c0), ...],
    "viz": {
        "samples": [[r,c], ...],   # node positions
        "edges":   [[i,j], ...]    # index pairs into samples
    }
}`}</pre>

          <h4>MAP_TYPE values</h4>
          <table className="help-table">
            <tbody>
              {[
                ['GRID',           'Standard cell grid (A*, D*, BFS…)'],
                ['SAMPLING',       'Probabilistic — returns sample nodes + edges'],
                ['GRAPH',          'Explicit graph overlay'],
                ['POTENTIAL_FIELD','Force-field planner'],
                ['TRAJECTORY',     'Waypoint / trajectory-based'],
                ['AGENT',          'Multi-agent planner'],
              ].map(([k,v]) => (
                <tr key={k}><td><code>{k}</code></td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>

          <h4>Raising errors</h4>
          <pre>{`raise RuntimeError("MyPlanner: No path found!")`}</pre>
          <p>The engine catches this and forwards the message to the GUI.</p>

          <h4>Example skeleton</h4>
          <pre>{`MAP_TYPE = "GRID"

def find_path(grid, start, goal):
    rows, cols = len(grid), len(grid[0])
    # ... your algorithm here ...
    path = [start, ..., goal]
    return path`}</pre>

        </div>
      </div>
    </div>
  )
}

// ── PluginPanel ──────────────────────────────────────────────────────────────

export function PluginPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showHelp,    setShowHelp]    = useState(false)
  const [validation,  setValidation]  = useState<ValidationResult | null>(null)
  const [uploading,   setUploading]   = useState(false)
  const [uploadMsg,   setUploadMsg]   = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<{ name: string; content: string } | null>(null)

  const { connected, reloadAlgorithms } = useSimStore()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadMsg(null)

    const reader = new FileReader()
    reader.onload = ev => {
      const content = ev.target?.result as string
      const result  = validatePlugin(file.name, content)
      setValidation(result)
      setPendingFile(result.ok ? { name: file.name, content } : null)
    }
    reader.readAsText(file)
  }

  async function handleUpload() {
    if (!pendingFile || !connected) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const infos = await engineApi.uploadPlugin(pendingFile.name, pendingFile.content)
      reloadAlgorithms(infos as AlgorithmInfo[])
      setUploadMsg(`✓ "${pendingFile.name}" uploaded and registered.`)
      setValidation(null)
      setPendingFile(null)
    } catch (err) {
      setUploadMsg('✗ ' + String(err))
    } finally {
      setUploading(false)
    }
  }

  async function handleReload() {
    if (!connected) return
    try {
      const infos = await engineApi.reloadPlugins()
      reloadAlgorithms(infos as AlgorithmInfo[])
      setUploadMsg(`✓ Plugin directory rescanned — ${infos.length} plugin(s) loaded.`)
    } catch (err) {
      setUploadMsg('✗ ' + String(err))
    }
  }

  return (
    <>
      <div className="panel plugin-panel">
        <div className="plugin-panel-header">
          <h3>Plugins</h3>
          <button
            className="help-btn"
            title="Plugin authoring guide"
            onClick={() => setShowHelp(true)}
          >?</button>
        </div>

        <div className="plugin-actions">
          <button onClick={() => fileInputRef.current?.click()} disabled={!connected}>
            Upload .py
          </button>
          <button onClick={handleReload} disabled={!connected} title="Rescan methods directory">
            Reload
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".py"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Validation results */}
        {validation && (
          <div className="plugin-validation">
            {validation.errors.map((e, i) => (
              <div key={i} className="val-error">✗ {e}</div>
            ))}
            {validation.warnings.map((w, i) => (
              <div key={i} className="val-warn">⚠ {w}</div>
            ))}
            {validation.ok && (
              <div className="val-ok">✓ Plugin looks valid</div>
            )}
            {validation.ok && pendingFile && (
              <button
                className="btn-primary upload-confirm"
                onClick={handleUpload}
                disabled={uploading || !connected}
              >
                {uploading ? 'Uploading…' : `Submit "${pendingFile.name}"`}
              </button>
            )}
          </div>
        )}

        {uploadMsg && (
          <div className={`upload-msg ${uploadMsg.startsWith('✓') ? 'ok' : 'err'}`}>
            {uploadMsg}
          </div>
        )}
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  )
}
