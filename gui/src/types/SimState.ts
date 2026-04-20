/** Point on the grid: [x, y] */
export type GridPoint = [number, number];

/** Cell value */
export type CellValue = 0 | 1 | 2;   // 0=free, 1=obstacle, 2=moving

/** 2-D grid: grid[x][y] */
export type Grid = CellValue[][];

/** Map representation type (mirrors C++ MapType enum) */
export type MapType =
  | 'GRID'
  | 'GRAPH'
  | 'SAMPLING'
  | 'POTENTIAL_FIELD'
  | 'TRAJECTORY'
  | 'AGENT';

/** Per-algorithm metadata returned by the engine */
export interface AlgorithmInfo {
  name:     string;
  map_type: MapType;
}

/** Extra visualisation data returned by some plugins */
export interface VizData {
  /** Sample nodes: [[x,y], ...] */
  samples?: [number, number][];
  /** Roadmap edges as index pairs into samples: [[i,j], ...] */
  edges?: [number, number][];
  /** Raw field values per cell for POTENTIAL_FIELD (optional future use) */
  field?: number[][];
}

export type BrushShape = 'square' | 'circle';

export interface SimState {
  rows: number;
  cols: number;
  grid: Grid;
  start: GridPoint | null;
  goal: GridPoint | null;
  path: GridPoint[];
  algorithmInfos: AlgorithmInfo[];
  algorithms: string[];          // kept for backward compat (derived from algorithmInfos)
  selectedAlgorithm: string;
  mapType: MapType;
  vizData: VizData | null;
  elapsedMs: number | null;
  connected: boolean;
  status: string;
  noPathError: boolean;
  brushShape: BrushShape;
  brushRadius: number;
}

export const defaultSimState = (): SimState => ({
  rows: 20,
  cols: 20,
  grid: Array.from({ length: 20 }, () => Array(20).fill(0)) as Grid,
  start: null,
  goal: null,
  path: [],
  algorithmInfos: [],
  algorithms: [],
  selectedAlgorithm: '',
  mapType: 'GRID',
  vizData: null,
  elapsedMs: null,
  connected: false,
  status: 'Disconnected',
  noPathError: false,
  brushShape: 'square',
  brushRadius: 1,
});
