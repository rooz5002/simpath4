/**
 * WebSocket client for the 3D engine (port 8766).
 */

const WS_URL_3D       = 'ws://localhost:8766'
const RECONNECT_DELAY = 2000

type Resolve = (v: string) => void
type Reject  = (e: Error)  => void
interface Pending { resolve: Resolve; reject: Reject }

export interface GridState3D {
  xs: number; ys: number; zs: number
  z_min?: number; z_max?: number
  obstacle_shape?: 'box' | 'sphere'
  obstacles: [number,number,number][]
}

class EngineApi3D {
  private ws: WebSocket | null = null
  private queue: Pending[] = []
  private onConnectCb:    (() => void) | null = null
  private onDisconnectCb: (() => void) | null = null

  connect(onConnect: () => void, onDisconnect: () => void) {
    this.onConnectCb    = onConnect
    this.onDisconnectCb = onDisconnect
    this.open()
  }

  disconnect() {
    this.onConnectCb    = null
    this.onDisconnectCb = null
    this.ws?.close()
    this.ws = null
  }

  private open() {
    if (this.ws &&
        (this.ws.readyState === WebSocket.OPEN ||
         this.ws.readyState === WebSocket.CONNECTING)) return

    this.ws = new WebSocket(WS_URL_3D)

    this.ws.onopen = () => {
      console.log('[EngineApi3D] connected')
      this.onConnectCb?.()
    }
    this.ws.onclose = () => {
      console.warn('[EngineApi3D] disconnected')
      this.onDisconnectCb?.()
      for (const p of this.queue) p.reject(new Error('3D engine disconnected'))
      this.queue = []
      if (this.onConnectCb)   // only retry if still in 3D mode
        setTimeout(() => this.open(), RECONNECT_DELAY)
    }
    this.ws.onerror = (ev) => console.error('[EngineApi3D] error', ev)
    this.ws.onmessage = (ev) => {
      const p = this.queue.shift()
      if (p) p.resolve(ev.data as string)
    }
  }

  private send(msg: object): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('3D engine not connected')); return
      }
      this.queue.push({ resolve, reject })
      this.ws.send(JSON.stringify(msg))
    })
  }

  async listAlgorithms(): Promise<string[]> {
    const r = await this.send({ type: 'list_algorithms' })
    const j = JSON.parse(r)
    const names = j.names ?? []
    // 2D engine returns [{name, map_type}], pure 3D engine returns strings
    return names.map((n: string | { name: string }) =>
      typeof n === 'string' ? n : n.name
    )
  }

  async setGrid(xs: number, ys: number, zs: number): Promise<void> {
    const r = await this.send({ type: 'set_grid', xs, ys, zs })
    const j = JSON.parse(r)
    if (j.type === 'error') throw new Error(j.message)
  }

  async generateObstacles(density: number, shape: 'cube'|'sphere' = 'cube', radius = 2): Promise<void> {
    const r = await this.send({ type: 'generate_obstacles', density, shape, radius })
    const j = JSON.parse(r)
    if (j.type === 'error') throw new Error(j.message)
  }

  async setObstaclesBulk(obstacles: [number,number,number][]): Promise<void> {
    const r = await this.send({ type: 'set_obstacles_bulk', obstacles })
    const j = JSON.parse(r)
    if (j.type === 'error') throw new Error(j.message)
  }

  async setHeightLimits(z_min: number, z_max: number): Promise<void> {
    const r = await this.send({ type: 'set_height_limits', z_min, z_max })
    const j = JSON.parse(r)
    if (j.type === 'error') throw new Error(j.message)
  }

  async uploadPlugin(filename: string, content: string): Promise<string[]> {
    const r = await this.send({ type: 'upload_plugin', filename, content })
    const j = JSON.parse(r)
    if (j.type === 'error') throw new Error(j.message)
    return j.names as string[]
  }

  async reloadPlugins(): Promise<string[]> {
    const r = await this.send({ type: 'reload_plugins' })
    const j = JSON.parse(r)
    if (j.type === 'error') throw new Error(j.message)
    return j.names as string[]
  }

  async getGrid(): Promise<GridState3D> {
    const r = await this.send({ type: 'get_grid' })
    const j = JSON.parse(r)
    if (j.type === 'error') throw new Error(j.message)
    return j as GridState3D
  }

  async findPath(
    algorithm: string,
    start: [number,number,number],
    goal:  [number,number,number],
  ): Promise<{ path: [number,number,number][]; elapsed_ms: number }> {
    const r = await this.send({ type: 'find_path', algorithm, start, goal })
    const j = JSON.parse(r)
    if (j.type === 'error') throw new Error(j.message)
    return { path: j.path, elapsed_ms: j.elapsed_ms }
  }
}

export const engineApi3D = new EngineApi3D()
