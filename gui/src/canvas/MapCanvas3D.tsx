import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { engineApi3D, type GridState3D } from '../api/engineApi3D'

export interface MapCanvas3DHandle {
  refreshGrid: () => void
  setPath: (path: [number,number,number][]) => void
}

const VOXEL  = 1       // voxel size in world units
const GAP    = 0.05    // small gap between voxels

// Colours
const C_OBSTACLE = 0x4a4a6a
const C_START    = 0x00c853
const C_GOAL     = 0xff1744
const C_PATH     = 0x2196f3

interface Props {
  xs: number; ys: number; zs: number
  start: [number,number,number]
  goal:  [number,number,number]
}

export const MapCanvas3D = forwardRef<MapCanvas3DHandle, Props>(
  function MapCanvas3D({ xs, ys, zs, start, goal }, ref) {
    const mountRef   = useRef<HTMLDivElement>(null)
    const sceneRef   = useRef<THREE.Scene | null>(null)
    const rendRef    = useRef<THREE.WebGLRenderer | null>(null)
    const camRef     = useRef<THREE.PerspectiveCamera | null>(null)
    const ctrlRef    = useRef<OrbitControls | null>(null)
    const frameRef   = useRef<number>(0)
    const gridRef    = useRef<THREE.Group | null>(null)
    const pathRef    = useRef<THREE.Line | null>(null)
    const markersRef = useRef<THREE.Mesh[]>([])

    // ── Helpers ─────────────────────────────────────────────────────────────
    function worldPos(x: number, y: number, z: number): THREE.Vector3 {
      return new THREE.Vector3(
        x * (VOXEL + GAP),
        z * (VOXEL + GAP),   // Z = altitude (up)
        y * (VOXEL + GAP),
      )
    }

    // ── Init scene ───────────────────────────────────────────────────────────
    useEffect(() => {
      const el = mountRef.current!
      const W  = el.clientWidth  || 800
      const H  = el.clientHeight || 600

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setClearColor(0x0d0d1a)
      el.appendChild(renderer.domElement)
      rendRef.current = renderer

      const scene = new THREE.Scene()
      scene.add(new THREE.AmbientLight(0xffffff, 0.6))
      const dir = new THREE.DirectionalLight(0xffffff, 0.8)
      dir.position.set(10, 20, 10)
      scene.add(dir)
      sceneRef.current = scene

      const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000)
      camera.position.set(xs * 1.5, zs * 2, ys * 2)
      camRef.current = camera

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      ctrlRef.current = controls

      // Axes helper
      scene.add(new THREE.AxesHelper(Math.max(xs, ys, zs) * 0.5))

      // Animation loop
      function animate() {
        frameRef.current = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      // Resize observer
      const ro = new ResizeObserver(() => {
        const w = el.clientWidth; const h = el.clientHeight
        renderer.setSize(w, h)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      })
      ro.observe(el)

      return () => {
        cancelAnimationFrame(frameRef.current)
        ro.disconnect()
        renderer.dispose()
        el.removeChild(renderer.domElement)
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Refresh grid from engine ─────────────────────────────────────────────
    async function refreshGrid() {
      const scene = sceneRef.current
      if (!scene) return

      // Remove old grid group
      if (gridRef.current) { scene.remove(gridRef.current); gridRef.current = null }

      let state: GridState3D
      try { state = await engineApi3D.getGrid() }
      catch { return }

      const group = new THREE.Group()
      const useSphere = state.obstacle_shape === 'sphere'
      const geo = useSphere
        ? new THREE.SphereGeometry((VOXEL - GAP) * 0.5, 8, 6)
        : new THREE.BoxGeometry(VOXEL - GAP, VOXEL - GAP, VOXEL - GAP)
      const obsMat = new THREE.MeshLambertMaterial({ color: C_OBSTACLE })

      for (const [x, y, z] of state.obstacles) {
        const mesh = new THREE.Mesh(geo, obsMat)
        mesh.position.copy(worldPos(x, y, z))
        group.add(mesh)
      }

      // Bounding box wireframe
      const bx = state.xs * (VOXEL + GAP)
      const by = state.zs * (VOXEL + GAP)
      const bz = state.ys * (VOXEL + GAP)
      const boxGeo = new THREE.BoxGeometry(bx, by, bz)
      const edges  = new THREE.EdgesGeometry(boxGeo)
      const line   = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x2a2a4a }))
      line.position.set(bx/2 - (VOXEL+GAP)/2, by/2 - (VOXEL+GAP)/2, bz/2 - (VOXEL+GAP)/2)
      group.add(line)

      scene.add(group)
      gridRef.current = group

      // Update start/goal markers
      updateMarkers()
    }

    function updateMarkers() {
      const scene = sceneRef.current
      if (!scene) return
      for (const m of markersRef.current) scene.remove(m)
      markersRef.current = []

      const sGeo = new THREE.SphereGeometry(0.35, 12, 12)

      const startMesh = new THREE.Mesh(sGeo, new THREE.MeshLambertMaterial({ color: C_START }))
      startMesh.position.copy(worldPos(...start))
      scene.add(startMesh)
      markersRef.current.push(startMesh)

      const goalMesh = new THREE.Mesh(sGeo, new THREE.MeshLambertMaterial({ color: C_GOAL }))
      goalMesh.position.copy(worldPos(...goal))
      scene.add(goalMesh)
      markersRef.current.push(goalMesh)
    }

    function setPath(path: [number,number,number][]) {
      const scene = sceneRef.current
      if (!scene) return

      if (pathRef.current) { scene.remove(pathRef.current); pathRef.current = null }
      if (path.length < 2) return

      const points = path.map(([x,y,z]) => worldPos(x, y, z))
      const geo    = new THREE.BufferGeometry().setFromPoints(points)
      const mat    = new THREE.LineBasicMaterial({ color: C_PATH, linewidth: 2 })
      const line   = new THREE.Line(geo, mat)
      scene.add(line)
      pathRef.current = line
    }

    // Expose handle
    useImperativeHandle(ref, () => ({ refreshGrid, setPath }))

    // Re-draw markers when start/goal props change
    useEffect(() => { updateMarkers() }, [start, goal])

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 500 }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
        {/* Copyright watermark */}
        <div style={{
          position:      'absolute',
          bottom:        6,
          right:         8,
          fontSize:      '10px',
          color:         'rgba(255,255,255,0.15)',
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
)
