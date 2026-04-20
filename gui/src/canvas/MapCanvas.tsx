import { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { useSimStore } from '../api/stateStore'
import type { GridPoint } from '../types/SimState'

const CELL_SIZE  = 24   // px per grid cell
const GAP        = 1    // px gap between cells

// Cell colours
const C_FREE     = 0x1a1a2e   // dark navy
const C_OBSTACLE = 0x4a4a5a   // grey
const C_START    = 0x00c853   // green
const C_GOAL     = 0xff1744   // red
const C_PATH     = 0x2196f3   // blue
const C_HOVER    = 0x455a64   // blue-grey

type InteractMode = 'obstacle' | 'start' | 'goal'

/** Convert grid (x,y) to canvas pixel centre. */
function cellCentre(x: number, y: number): [number, number] {
  return [
    y * (CELL_SIZE + GAP) + CELL_SIZE / 2,
    x * (CELL_SIZE + GAP) + CELL_SIZE / 2,
  ]
}

export function MapCanvas() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const overlayRef   = useRef<HTMLCanvasElement>(null)
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef     = useRef<THREE.Scene | null>(null)
  const cameraRef    = useRef<THREE.OrthographicCamera | null>(null)
  const meshesRef    = useRef<THREE.Mesh[][]>([])   // meshes[x][y]
  const hoverRef     = useRef<GridPoint | null>(null)
  const modeRef      = useRef<InteractMode>('obstacle')
  const isPaintingRef = useRef(false)

  const { rows, cols, grid, start, goal, path, mapType, vizData,
          paintBrush, setStart, setGoal } = useSimStore()

  // ── Initialise WebGL renderer ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0d0d1a)
    sceneRef.current = scene

    const W = cols * (CELL_SIZE + GAP)
    const H = rows * (CELL_SIZE + GAP)
    renderer.setSize(W, H)

    const camera = new THREE.OrthographicCamera(0, W, 0, -H, -1, 1)
    cameraRef.current = camera

    // Build mesh grid
    const geometry = new THREE.PlaneGeometry(CELL_SIZE - GAP, CELL_SIZE - GAP)
    const meshes: THREE.Mesh[][] = []
    for (let x = 0; x < rows; x++) {
      meshes[x] = []
      for (let y = 0; y < cols; y++) {
        const mat  = new THREE.MeshBasicMaterial({ color: C_FREE })
        const mesh = new THREE.Mesh(geometry, mat)
        mesh.position.set(
          y * (CELL_SIZE + GAP) + CELL_SIZE / 2,
          -(x * (CELL_SIZE + GAP) + CELL_SIZE / 2),
          0,
        )
        scene.add(mesh)
        meshes[x][y] = mesh
      }
    }
    meshesRef.current = meshes

    renderer.render(scene, camera)

    return () => {
      renderer.dispose()
      geometry.dispose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols])

  // ── Repaint grid cells whenever state changes ──────────────────────────────
  useEffect(() => {
    const meshes = meshesRef.current
    if (!meshes.length) return

    const pathSet = new Set(path.map(([px, py]) => `${px},${py}`))

    for (let x = 0; x < rows; x++) {
      for (let y = 0; y < cols; y++) {
        const mat = (meshes[x]?.[y]?.material as THREE.MeshBasicMaterial)
        if (!mat) continue

        if (start && start[0] === x && start[1] === y)
          mat.color.set(C_START)
        else if (goal && goal[0] === x && goal[1] === y)
          mat.color.set(C_GOAL)
        else if (pathSet.has(`${x},${y}`))
          mat.color.set(C_PATH)
        else if (grid[x][y] !== 0)
          mat.color.set(C_OBSTACLE)
        else
          mat.color.set(C_FREE)
      }
    }

    const r = rendererRef.current
    const s = sceneRef.current
    const c = cameraRef.current
    if (r && s && c) r.render(s, c)
  }, [rows, cols, grid, start, goal, path])

  // ── Overlay: SAMPLING roadmap or GRAPH adjacency ──────────────────────────
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    if (!ctx) return

    const W = cols * (CELL_SIZE + GAP)
    const H = rows * (CELL_SIZE + GAP)
    ctx.clearRect(0, 0, W, H)

    if (mapType === 'SAMPLING' && vizData) {
      const { samples, edges } = vizData

      // Roadmap edges
      if (edges && samples) {
        ctx.strokeStyle = 'rgba(100, 160, 255, 0.25)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        for (const [i, j] of edges) {
          const s0 = samples[i]; const s1 = samples[j]
          if (!s0 || !s1) continue
          const [px0, py0] = cellCentre(s0[0], s0[1])
          const [px1, py1] = cellCentre(s1[0], s1[1])
          ctx.moveTo(px0, py0); ctx.lineTo(px1, py1)
        }
        ctx.stroke()
      }

      // Sample nodes
      if (samples) {
        ctx.fillStyle = 'rgba(130, 180, 255, 0.55)'
        for (const [sx, sy] of samples) {
          const [px, py] = cellCentre(sx, sy)
          ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill()
        }
      }
    }

    if (mapType === 'GRAPH') {
      // Show adjacency graph: edges between neighboring free cells
      ctx.strokeStyle = 'rgba(80, 200, 120, 0.20)'
      ctx.lineWidth = 0.7
      ctx.beginPath()
      for (let x = 0; x < rows; x++) {
        for (let y = 0; y < cols; y++) {
          if (grid[x][y] !== 0) continue
          const [px, py] = cellCentre(x, y)
          // right neighbor
          if (y + 1 < cols && grid[x][y + 1] === 0) {
            const [qx, qy] = cellCentre(x, y + 1)
            ctx.moveTo(px, py); ctx.lineTo(qx, qy)
          }
          // down neighbor
          if (x + 1 < rows && grid[x + 1][y] === 0) {
            const [qx, qy] = cellCentre(x + 1, y)
            ctx.moveTo(px, py); ctx.lineTo(qx, qy)
          }
        }
      }
      ctx.stroke()

      // Node dots at free cells
      ctx.fillStyle = 'rgba(80, 200, 120, 0.35)'
      for (let x = 0; x < rows; x++) {
        for (let y = 0; y < cols; y++) {
          if (grid[x][y] !== 0) continue
          const [px, py] = cellCentre(x, y)
          ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2); ctx.fill()
        }
      }
    }

    // Draw solved path on top (for non-GRID types where cells aren't coloured blue)
    if ((mapType === 'SAMPLING' || mapType === 'GRAPH') && path.length > 1) {
      ctx.strokeStyle = 'rgba(33, 150, 243, 0.9)'
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.beginPath()
      const [px0, py0] = cellCentre(path[0][0], path[0][1])
      ctx.moveTo(px0, py0)
      for (let k = 1; k < path.length; k++) {
        const [px, py] = cellCentre(path[k][0], path[k][1])
        ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
  }, [rows, cols, grid, mapType, vizData, path])

  // ── Cell under pointer ─────────────────────────────────────────────────────
  const cellAt = useCallback((e: React.MouseEvent<HTMLCanvasElement>): GridPoint | null => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const px   = e.clientX - rect.left
    const py   = e.clientY - rect.top
    const x    = Math.floor(py / (CELL_SIZE + GAP))
    const y    = Math.floor(px / (CELL_SIZE + GAP))
    if (x < 0 || x >= rows || y < 0 || y >= cols) return null
    return [x, y]
  }, [rows, cols])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const pt = cellAt(e)
    if (!pt) return
    const mode = modeRef.current
    if (mode === 'start')    { setStart(pt); modeRef.current = 'obstacle'; return }
    if (mode === 'goal')     { setGoal(pt);  modeRef.current = 'obstacle'; return }
    isPaintingRef.current = true
    paintBrush(pt[0], pt[1])
  }, [cellAt, paintBrush, setStart, setGoal])

  const handleMouseUp = useCallback(() => {
    isPaintingRef.current = false
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = cellAt(e)
    const prev = hoverRef.current
    if (prev) {
      const mat = meshesRef.current[prev[0]]?.[prev[1]]?.material as THREE.MeshBasicMaterial
      if (mat) {
        const inPath = path.some(([px, py]) => px === prev[0] && py === prev[1])
        const isStart = start && start[0] === prev[0] && start[1] === prev[1]
        const isGoal  = goal  && goal[0]  === prev[0] && goal[1]  === prev[1]
        if (isStart) mat.color.set(C_START)
        else if (isGoal) mat.color.set(C_GOAL)
        else if (inPath) mat.color.set(C_PATH)
        else if (grid[prev[0]][prev[1]] !== 0) mat.color.set(C_OBSTACLE)
        else mat.color.set(C_FREE)
      }
    }
    hoverRef.current = pt
    if (pt) {
      const mat = meshesRef.current[pt[0]]?.[pt[1]]?.material as THREE.MeshBasicMaterial
      if (mat) mat.color.set(C_HOVER)
      // Drag-paint
      if (isPaintingRef.current && modeRef.current === 'obstacle') {
        paintBrush(pt[0], pt[1])
      }
    }
    const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current
    if (r && s && c) r.render(s, c)
  }, [cellAt, grid, path, start, goal, paintBrush])

  // Expose mode setter so ControlPanel can trigger it
  ;(MapCanvas as { setMode?: (m: InteractMode) => void }).setMode =
    (m: InteractMode) => { modeRef.current = m }

  const W = cols * (CELL_SIZE + GAP)
  const H = rows * (CELL_SIZE + GAP)

  return (
    <div style={{ position: 'relative', width: W, height: H }}>
      {/* WebGL base layer */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ position: 'absolute', top: 0, left: 0, display: 'block' }}
      />
      {/* 2D overlay for sampling/graph viz + interaction */}
      <canvas
        ref={overlayRef}
        width={W}
        height={H}
        style={{ position: 'absolute', top: 0, left: 0, display: 'block', pointerEvents: 'auto' }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
      />
      {/* Copyright watermark */}
      <div style={{
        position:      'absolute',
        bottom:        4,
        right:         6,
        fontSize:      '10px',
        color:         'rgba(255,255,255,0.18)',
        pointerEvents: 'none',
        userSelect:    'none',
        fontFamily:    'monospace',
        letterSpacing: '0.05em',
      }}>
        © 2025 Amir Ali Mokhtarzadeh · SIMPATH 4
      </div>
    </div>
  )
}
