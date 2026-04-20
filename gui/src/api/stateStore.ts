import { create } from 'zustand'
import { SimState, defaultSimState, GridPoint, CellValue, Grid, MapType, VizData, AlgorithmInfo, BrushShape } from '../types/SimState'
import { engineApi } from './engineApi'

interface Store extends SimState {
  // Actions
  connect: () => void;
  setGridSize: (rows: number, cols: number) => Promise<void>;
  toggleCell: (x: number, y: number) => void;
  paintBrush: (cx: number, cy: number) => void;
  setBrushShape: (s: BrushShape) => void;
  setBrushRadius: (r: number) => void;
  setStart: (pt: GridPoint) => void;
  setGoal:  (pt: GridPoint) => void;
  setAlgorithm: (name: string) => void;
  setMapType: (mt: MapType) => void;
  reloadAlgorithms: (infos: AlgorithmInfo[]) => void;
  runPathFind: () => Promise<void>;
  clearPath: () => void;
  resetGrid: () => void;
  saveWorkspace: () => void;
  loadWorkspace: (file: File) => Promise<void>;
}

export const useSimStore = create<Store>((set, get) => ({
  ...defaultSimState(),

  connect() {
    engineApi.connect(
      async () => {
        set({ connected: true, status: 'Connected' });
        try {
          const algorithmInfos = await engineApi.listAlgorithms() as AlgorithmInfo[];
          const algorithms = algorithmInfos.map(a => a.name);
          const { rows, cols, grid } = get();
          await engineApi.setGrid(rows, cols, grid as number[][]);
          const firstMapType = (algorithmInfos[0]?.map_type ?? 'GRID') as MapType;
          set({
            algorithmInfos,
            algorithms,
            selectedAlgorithm: algorithms[0] ?? '',
            mapType: firstMapType,
            status: 'Ready',
          });
        } catch (e: unknown) {
          set({ status: 'Init error: ' + String(e) });
        }
      },
      () => set({ connected: false, status: 'Disconnected', path: [], vizData: null }),
    );
  },

  async setGridSize(rows, cols) {
    const grid = Array.from({ length: rows }, () =>
      Array(cols).fill(0)
    ) as Grid;
    set({ rows, cols, grid, start: null, goal: null, path: [], vizData: null });
    if (get().connected) {
      await engineApi.setGrid(rows, cols, grid as number[][]);
    }
  },

  toggleCell(x, y) {
    const { grid } = get();
    const current = grid[x][y] as CellValue;
    const next: CellValue = current === 0 ? 1 : 0;
    const newGrid = grid.map((col, ci) =>
      col.map((cell, ri) => (ci === x && ri === y ? next : cell))
    ) as Grid;
    set({ grid: newGrid, path: [], vizData: null });
    if (get().connected) {
      engineApi.setObstacle(x, y, next).catch(console.error);
    }
  },

  paintBrush(cx, cy) {
    const { grid, rows, cols, brushShape, brushRadius, connected } = get();
    // Determine value: toggle center, then paint all brush cells to that value
    const centerVal = grid[cx]?.[cy] as CellValue ?? 0;
    const paintVal: CellValue = centerVal === 0 ? 1 : 0;

    const r = brushRadius - 1;  // radius in cells (0 = single cell)
    const cells: [number, number][] = [];
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (brushShape === 'circle' && dx * dx + dy * dy > r * r) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= rows || ny < 0 || ny >= cols) continue;
        cells.push([nx, ny]);
      }
    }

    const newGrid = grid.map(row => [...row]) as Grid;
    for (const [nx, ny] of cells) {
      newGrid[nx][ny] = paintVal;
    }
    set({ grid: newGrid, path: [], vizData: null });
    if (connected) {
      for (const [nx, ny] of cells) {
        engineApi.setObstacle(nx, ny, paintVal).catch(console.error);
      }
    }
  },

  setBrushShape(s) { set({ brushShape: s }); },
  setBrushRadius(r) { set({ brushRadius: Math.max(1, Math.min(10, r)) }); },

  setStart(pt) { set({ start: pt, path: [], vizData: null }); },
  setGoal(pt)  { set({ goal: pt,  path: [], vizData: null }); },

  setAlgorithm(name) {
    const { algorithmInfos } = get();
    const info = algorithmInfos.find(a => a.name === name);
    set({
      selectedAlgorithm: name,
      mapType: (info?.map_type ?? 'GRID') as MapType,
      path: [],
      vizData: null,
    });
  },

  setMapType(mt) {
    set({ mapType: mt, vizData: null });
  },

  reloadAlgorithms(infos) {
    const algorithms = infos.map(a => a.name);
    set({ algorithmInfos: infos, algorithms });
  },

  async runPathFind() {
    const { start, goal, selectedAlgorithm, connected } = get();
    if (!start || !goal || !selectedAlgorithm || !connected) return;
    set({ status: 'Running…', path: [], vizData: null, noPathError: false });
    try {
      const result = await engineApi.findPath(selectedAlgorithm, start, goal);
      set({
        path: result.path as GridPoint[],
        elapsedMs: result.elapsed_ms,
        mapType: (result.map_type ?? 'GRID') as MapType,
        vizData: (result.viz as VizData) ?? null,
        status: 'Done',
        noPathError: false,
      });
    } catch (e: unknown) {
      const msg = String(e)
      const isNoPath = /no path|not reachable|not found|dead end|cycle detected/i.test(msg)
      set({
        status: isNoPath ? 'No path to the Goal' : 'Error: ' + msg,
        noPathError: isNoPath,
        path: [],
        vizData: null,
      });
    }
  },

  clearPath() { set({ path: [], vizData: null, elapsedMs: null, status: 'Ready', noPathError: false }); },

  saveWorkspace() {
    const { rows, cols, grid, start, goal, selectedAlgorithm, mapType } = get();
    const workspace = {
      version: 1,
      rows, cols, grid, start, goal,
      selectedAlgorithm, mapType,
    };
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'workspace.simpath';
    a.click();
    URL.revokeObjectURL(url);
  },

  async loadWorkspace(file) {
    const text = await file.text();
    let ws: Record<string, unknown>;
    try { ws = JSON.parse(text); }
    catch { throw new Error('Invalid .simpath file'); }

    const rows = (ws.rows as number) ?? 20;
    const cols = (ws.cols as number) ?? 20;
    const grid = (ws.grid as Grid) ?? (Array.from({ length: rows }, () => Array(cols).fill(0)) as Grid);
    const start = (ws.start as GridPoint | null) ?? null;
    const goal  = (ws.goal  as GridPoint | null) ?? null;
    const selectedAlgorithm = (ws.selectedAlgorithm as string) ?? '';
    const mapType = (ws.mapType as MapType) ?? 'GRID';

    set({ rows, cols, grid, start, goal, selectedAlgorithm, mapType, path: [], vizData: null, elapsedMs: null });

    if (get().connected) {
      await engineApi.setGrid(rows, cols, grid as number[][]);
    }
  },

  resetGrid() {
    const { rows, cols } = get();
    const grid = Array.from({ length: rows }, () =>
      Array(cols).fill(0)
    ) as Grid;
    set({ grid, start: null, goal: null, path: [], vizData: null });
    if (get().connected) {
      engineApi.setGrid(rows, cols, grid as number[][]).catch(console.error);
    }
  },
}));
