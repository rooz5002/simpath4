/**
 * Low-level WebSocket client for the C++ engine.
 *
 * One pending promise per outgoing message (request-response).
 * Automatically reconnects when the connection drops.
 */

const WS_URL = 'ws://localhost:8765';
const RECONNECT_DELAY_MS = 2000;

type Resolve = (value: string) => void;
type Reject  = (reason: Error)  => void;

interface Pending { resolve: Resolve; reject: Reject }

class EngineApi {
  private ws: WebSocket | null = null;
  private queue: Pending[] = [];
  private onConnectCb: (() => void)  | null = null;
  private onDisconnectCb: (() => void) | null = null;

  connect(
    onConnect: () => void,
    onDisconnect: () => void,
  ) {
    this.onConnectCb    = onConnect;
    this.onDisconnectCb = onDisconnect;
    this.open();
  }

  private open() {
    // If already open or connecting, don't create a second socket
    if (this.ws &&
        (this.ws.readyState === WebSocket.OPEN ||
         this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log('[EngineApi] connected');
      this.onConnectCb?.();
    };

    this.ws.onclose = () => {
      console.warn('[EngineApi] disconnected — retrying in', RECONNECT_DELAY_MS, 'ms');
      this.onDisconnectCb?.();
      for (const p of this.queue) p.reject(new Error('WebSocket closed'));
      this.queue = [];
      setTimeout(() => this.open(), RECONNECT_DELAY_MS);
    };

    this.ws.onerror = (ev) => {
      console.error('[EngineApi] error', ev);
    };

    this.ws.onmessage = (ev) => {
      const pending = this.queue.shift();
      if (pending) pending.resolve(ev.data as string);
    };
  }

  send(msg: object): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }
      this.queue.push({ resolve, reject });
      this.ws.send(JSON.stringify(msg));
    });
  }

  async ping(): Promise<boolean> {
    try {
      const r = await this.send({ type: 'ping' });
      return JSON.parse(r).type === 'pong';
    } catch { return false; }
  }

  async listAlgorithms(): Promise<AlgorithmInfo[]> {
    const r = await this.send({ type: 'list_algorithms' });
    const j = JSON.parse(r);
    if (j.type === 'error') throw new Error(j.message);
    // Engine returns both "names" (legacy) and "algorithms" [{name, map_type}]
    if (j.algorithms) return j.algorithms as AlgorithmInfo[];
    // Fallback for older engine builds
    return (j.names as string[]).map((name: string) => ({ name, map_type: 'GRID' as const }));
  }

  async setGrid(rows: number, cols: number, cells: number[][]): Promise<void> {
    const r = await this.send({ type: 'set_grid', rows, cols, cells });
    const j = JSON.parse(r);
    if (j.type === 'error') throw new Error(j.message);
  }

  async setObstacle(x: number, y: number, value: number): Promise<void> {
    const r = await this.send({ type: 'set_obstacle', x, y, value });
    const j = JSON.parse(r);
    if (j.type === 'error') throw new Error(j.message);
  }

  async findPath(
    algorithm: string,
    start: [number, number],
    goal:  [number, number],
  ): Promise<{ path: [number, number][]; elapsed_ms: number; map_type: string; viz?: unknown }> {
    const r = await this.send({ type: 'find_path', algorithm, start, goal });
    const j = JSON.parse(r);
    if (j.type === 'error') throw new Error(j.message);
    return { path: j.path, elapsed_ms: j.elapsed_ms, map_type: j.map_type ?? 'GRID', viz: j.viz };
  }

  async getLicense(): Promise<LicenseStatus> {
    const r = await this.send({ type: 'get_license' });
    const j = JSON.parse(r);
    if (j.type === 'error') throw new Error(j.message);
    return j as LicenseStatus;
  }

  async uploadPlugin(filename: string, content: string): Promise<AlgorithmInfo[]> {
    const r = await this.send({ type: 'upload_plugin', filename, content });
    const j = JSON.parse(r);
    if (j.type === 'error') throw new Error(j.message);
    return j.algorithms as AlgorithmInfo[];
  }

  async reloadPlugins(): Promise<AlgorithmInfo[]> {
    const r = await this.send({ type: 'reload_plugins' });
    const j = JSON.parse(r);
    if (j.type === 'error') throw new Error(j.message);
    return j.algorithms as AlgorithmInfo[];
  }

  async activateLicense(key: string): Promise<LicenseStatus> {
    const r = await this.send({ type: 'activate_license', key });
    const j = JSON.parse(r);
    if (j.type === 'error') throw new Error(j.message);
    return j as LicenseStatus;
  }
}

export interface AlgorithmInfo {
  name:     string;
  map_type: string;
}

export interface LicenseStatus {
  valid:         boolean
  tier:          string
  issued_date:   string
  machine_bound: boolean
  message:       string
}

// Singleton
export const engineApi = new EngineApi();
