import { useRef, useState } from 'react'
import { engineApi3D } from '../api/engineApi3D'

// ── plugin validation (same rules as 2D but requires MAP_TYPE=VOXEL) ─────────
function validatePlugin3D(filename: string, content: string) {
  const errors: string[] = []
  const warnings: string[] = []
  if (!filename.endsWith('.py')) errors.push('File must have a .py extension.')
  if (!content.trim())           errors.push('File is empty.')
  if (!/^def find_path\s*\(/m.test(content)) errors.push('Missing: def find_path(grid, start, goal)')
  if (!/^MAP_TYPE\s*=\s*["']VOXEL["']/m.test(content))
    warnings.push('MAP_TYPE is not "VOXEL" — plugin will be ignored by the 3D engine.')
  return { ok: errors.length === 0, errors, warnings }
}

interface Props {
  connected: boolean
  algorithms: string[]
  status: string
  onPathFound:    (path: [number,number,number][], ms: number) => void
  onPathClear:    () => void
  onGridChanged:  () => void
  onStatusChange: (s: string) => void
  onAlgosChanged: (algos: string[]) => void
}

type ObstacleShape = 'cube' | 'sphere'

export function Panel3D({
  connected, algorithms, status,
  onPathFound, onPathClear, onGridChanged, onStatusChange, onAlgosChanged,
}: Props) {
  // Grid
  const [xs, setXs] = useState(15)
  const [ys, setYs] = useState(15)
  const [zs, setZs] = useState(8)

  // Obstacles
  const [density,  setDensity]  = useState(20)
  const [shape,    setShape]    = useState<ObstacleShape>('cube')
  const [radius,   setRadius]   = useState(2)

  // Height limits
  const [zMin, setZMin] = useState(0)
  const [zMax, setZMax] = useState(7)

  // Start / Goal
  const [sx, setSx] = useState(0)
  const [sy, setSy] = useState(0)
  const [sz, setSz] = useState(0)
  const [gx, setGx] = useState(14)
  const [gy, setGy] = useState(14)
  const [gz, setGz] = useState(7)

  // Algorithm
  const [algo, setAlgo] = useState(algorithms[0] ?? '')
  const [elapsed, setElapsed] = useState<number | null>(null)

  // Plugin upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pluginVal,  setPluginVal]  = useState<{ok:boolean;errors:string[];warnings:string[]}|null>(null)
  const [pendingPlugin, setPendingPlugin] = useState<{name:string;content:string}|null>(null)
  const [pluginMsg, setPluginMsg] = useState<string|null>(null)

  // Workspace
  const loadInputRef = useRef<HTMLInputElement>(null)

  // ── grid ────────────────────────────────────────────────────────────────────
  async function applyGrid() {
    if (!connected) return
    onStatusChange('Setting grid…')
    try {
      await engineApi3D.setGrid(xs, ys, zs)
      setGx(xs-1); setGy(ys-1); setGz(zs-1)
      setZMax(zs-1)
      await engineApi3D.setHeightLimits(zMin, zs-1)
      onGridChanged(); onStatusChange('Ready')
    } catch(e) { onStatusChange('Error: '+String(e)) }
  }

  // ── obstacles ───────────────────────────────────────────────────────────────
  async function generateObstacles() {
    if (!connected) return
    onStatusChange('Generating obstacles…')
    try {
      await engineApi3D.generateObstacles(density, shape, radius)
      onGridChanged(); onStatusChange('Ready')
    } catch(e) { onStatusChange('Error: '+String(e)) }
  }

  // ── height limits ────────────────────────────────────────────────────────────
  async function applyHeightLimits() {
    if (!connected) return
    try {
      await engineApi3D.setHeightLimits(zMin, zMax)
      onStatusChange('Height limits applied')
    } catch(e) { onStatusChange('Error: '+String(e)) }
  }

  // ── clear obstacles ──────────────────────────────────────────────────────────
  async function clearObstacles() {
    if (!connected) return
    try {
      await engineApi3D.setObstaclesBulk([])
      onGridChanged(); onStatusChange('Ready')
    } catch(e) { onStatusChange('Error: '+String(e)) }
  }

  // ── path find ────────────────────────────────────────────────────────────────
  async function findPath() {
    if (!connected) return
    onStatusChange('Running…'); setElapsed(null)
    try {
      const { path, elapsed_ms } = await engineApi3D.findPath(
        algo || algorithms[0], [sx,sy,sz], [gx,gy,gz]
      )
      setElapsed(elapsed_ms)
      onPathFound(path, elapsed_ms)
      onStatusChange('Done')
    } catch(e) { onStatusChange('Error: '+String(e)) }
  }

  // ── plugin upload ────────────────────────────────────────────────────────────
  function handlePluginFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value=''; setPluginMsg(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const content = ev.target?.result as string
      const v = validatePlugin3D(file.name, content)
      setPluginVal(v)
      setPendingPlugin(v.ok ? {name: file.name, content} : null)
    }
    reader.readAsText(file)
  }

  async function submitPlugin() {
    if (!pendingPlugin||!connected) return
    try {
      const algos = await engineApi3D.uploadPlugin(pendingPlugin.name, pendingPlugin.content)
      onAlgosChanged(algos)
      setPluginMsg(`✓ "${pendingPlugin.name}" uploaded.`)
      setPluginVal(null); setPendingPlugin(null)
    } catch(e) { setPluginMsg('✗ '+String(e)) }
  }

  async function reloadPlugins() {
    if (!connected) return
    try {
      const algos = await engineApi3D.reloadPlugins()
      onAlgosChanged(algos)
      setPluginMsg(`✓ ${algos.length} plugin(s) loaded.`)
    } catch(e) { setPluginMsg('✗ '+String(e)) }
  }

  // ── workspace save / load ────────────────────────────────────────────────────
  async function saveWorkspace() {
    try {
      const state = await engineApi3D.getGrid()
      const ws = { version:1, xs,ys,zs, zMin,zMax, sx,sy,sz, gx,gy,gz,
                   algo, obstacles: state.obstacles }
      const blob = new Blob([JSON.stringify(ws,null,2)],{type:'application/json'})
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href=url; a.download='workspace3d.simpath3d'; a.click()
      URL.revokeObjectURL(url)
    } catch(e) { onStatusChange('Save error: '+String(e)) }
  }

  async function loadWorkspace(file: File) {
    try {
      const text = await file.text()
      const ws   = JSON.parse(text)
      const nxs=ws.xs??10, nys=ws.ys??10, nzs=ws.zs??6
      setXs(nxs); setYs(nys); setZs(nzs)
      setZMin(ws.zMin??0); setZMax(ws.zMax??nzs-1)
      setSx(ws.sx??0); setSy(ws.sy??0); setSz(ws.sz??0)
      setGx(ws.gx??nxs-1); setGy(ws.gy??nys-1); setGz(ws.gz??nzs-1)
      if (ws.algo) setAlgo(ws.algo)
      await engineApi3D.setGrid(nxs, nys, nzs)
      if (ws.obstacles?.length)
        await engineApi3D.setObstaclesBulk(ws.obstacles)
      await engineApi3D.setHeightLimits(ws.zMin??0, ws.zMax??nzs-1)
      onGridChanged(); onStatusChange('Workspace loaded')
    } catch(e) { onStatusChange('Load error: '+String(e)) }
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  function numInput(val:number, set:(n:number)=>void, min:number, max:number, width=52) {
    return (
      <input type="number" min={min} max={max} value={val} style={{width}}
        onChange={e => set(Math.max(min, Math.min(max, parseInt(e.target.value)||min)))} />
    )
  }

  function coord(label:string, val:number, set:(n:number)=>void, max:number) {
    return (
      <label className="coord-label">
        {label} {numInput(val, set, 0, Math.max(0,max-1))}
      </label>
    )
  }

  return (
    <div className="panel panel3d">
      <h3>3D Environment</h3>
      <div style={{marginBottom:8}}>
        <div className={`status-dot ${connected?'ok':'err'}`} style={{display:'inline-block'}}/>
        <span className="status-text">{status}</span>
      </div>

      {/* Grid size */}
      <fieldset>
        <legend>Grid size</legend>
        <label className="coord-label">X {numInput(xs,setXs,2,80)}</label>
        <label className="coord-label">Y {numInput(ys,setYs,2,80)}</label>
        <label className="coord-label">Z {numInput(zs,setZs,2,40)}</label>
        <button onClick={applyGrid} disabled={!connected}>Apply</button>
      </fieldset>

      {/* Height limits */}
      <fieldset>
        <legend>Hover height (Z)</legend>
        <label className="coord-label">Min {numInput(zMin,setZMin,0,zs-1)}</label>
        <label className="coord-label">Max {numInput(zMax,setZMax,0,zs-1)}</label>
        <button onClick={applyHeightLimits} disabled={!connected}>Apply</button>
      </fieldset>

      {/* Obstacles */}
      <fieldset>
        <legend>Obstacles</legend>
        <label className="coord-label" style={{width:'100%'}}>
          Density
          <input type="range" min={0} max={80} value={density}
            onChange={e=>setDensity(parseInt(e.target.value))}
            style={{flex:1,marginLeft:8}}/>
          <span style={{minWidth:32,textAlign:'right'}}>{density}%</span>
        </label>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
          <label className="coord-label">
            Shape
            <select value={shape} onChange={e=>setShape(e.target.value as ObstacleShape)}
              style={{width:'auto',marginLeft:4,padding:'3px 6px'}}>
              <option value="cube">Cube</option>
              <option value="sphere">Sphere</option>
            </select>
          </label>
          {shape==='sphere' && (
            <label className="coord-label">
              r {numInput(radius,setRadius,1,8,40)}
            </label>
          )}
        </div>
        <button onClick={generateObstacles} disabled={!connected} style={{width:'100%'}}>
          Generate Random
        </button>
      </fieldset>

      {/* Start / Goal */}
      <fieldset>
        <legend>Start</legend>
        {coord('X',sx,setSx,xs)} {coord('Y',sy,setSy,ys)} {coord('Z',sz,setSz,zs)}
      </fieldset>
      <fieldset>
        <legend>Goal</legend>
        {coord('X',gx,setGx,xs)} {coord('Y',gy,setGy,ys)} {coord('Z',gz,setGz,zs)}
      </fieldset>

      {/* Algorithm */}
      <fieldset>
        <legend>Algorithm</legend>
        <select value={algo} onChange={e=>setAlgo(e.target.value)} disabled={algorithms.length===0}>
          {algorithms.length===0
            ? <option>— no plugins —</option>
            : algorithms.map(a=><option key={a}>{a}</option>)}
        </select>
      </fieldset>

      {/* Run */}
      <div className="actions">
        <button className="btn-primary" onClick={findPath}
          disabled={!connected||algorithms.length===0}>
          Find Path 3D
        </button>
        <button onClick={() => { onPathClear(); setElapsed(null) }}
          disabled={!connected}>
          Clear Path
        </button>
        <button onClick={clearObstacles} disabled={!connected}>
          Clear Obstacles
        </button>
      </div>
      {elapsed!==null && <p className="elapsed">Last run: <strong>{elapsed.toFixed(2)} ms</strong></p>}

      {/* Workspace */}
      <fieldset>
        <legend>Workspace</legend>
        <button onClick={saveWorkspace} disabled={!connected}>Save</button>
        <button onClick={()=>loadInputRef.current?.click()} disabled={!connected}>Load</button>
        <input ref={loadInputRef} type="file" accept=".simpath3d,.json"
          style={{display:'none'}}
          onChange={e=>{const f=e.target.files?.[0];if(f)loadWorkspace(f);e.target.value=''}}/>
      </fieldset>

      {/* Plugin upload */}
      <fieldset>
        <legend>3D Plugins</legend>
        <div style={{display:'flex',gap:6,marginBottom:6}}>
          <button onClick={()=>fileInputRef.current?.click()} disabled={!connected}>
            Upload .py
          </button>
          <button onClick={reloadPlugins} disabled={!connected}>Reload</button>
        </div>
        <input ref={fileInputRef} type="file" accept=".py" style={{display:'none'}}
          onChange={handlePluginFile}/>
        {pluginVal && (
          <div className="plugin-validation">
            {pluginVal.errors.map((e,i)=><div key={i} className="val-error">✗ {e}</div>)}
            {pluginVal.warnings.map((w,i)=><div key={i} className="val-warn">⚠ {w}</div>)}
            {pluginVal.ok && <div className="val-ok">✓ Valid</div>}
            {pluginVal.ok && pendingPlugin && (
              <button className="btn-primary upload-confirm" onClick={submitPlugin}>
                Submit "{pendingPlugin.name}"
              </button>
            )}
          </div>
        )}
        {pluginMsg && (
          <div className={`upload-msg ${pluginMsg.startsWith('✓')?'ok':'err'}`}>{pluginMsg}</div>
        )}
      </fieldset>
    </div>
  )
}
