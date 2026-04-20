import { useSimStore } from '../api/stateStore'
import type { MapType } from '../types/SimState'

const MAP_TYPES: MapType[] = ['GRID', 'GRAPH', 'SAMPLING', 'POTENTIAL_FIELD', 'TRAJECTORY', 'AGENT']

const MAP_TYPE_LABELS: Record<MapType, string> = {
  GRID:            'Grid',
  GRAPH:           'Graph',
  SAMPLING:        'Sampling',
  POTENTIAL_FIELD: 'Potential Field',
  TRAJECTORY:      'Trajectory',
  AGENT:           'Agent',
}

export function AlgorithmPanel() {
  const { algorithms, selectedAlgorithm, setAlgorithm, elapsedMs, mapType, setMapType } = useSimStore()

  return (
    <div className="panel algorithm-panel">
      <h3>Algorithm</h3>

      <label htmlFor="algo-select">Method</label>
      <select
        id="algo-select"
        value={selectedAlgorithm}
        onChange={e => setAlgorithm(e.target.value)}
        disabled={algorithms.length === 0}
      >
        {algorithms.length === 0 && (
          <option value="">— connecting… —</option>
        )}
        {algorithms.map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>

      <label htmlFor="map-type-select" style={{ marginTop: '0.75rem' }}>Map Type</label>
      <select
        id="map-type-select"
        value={mapType}
        onChange={e => setMapType(e.target.value as MapType)}
      >
        {MAP_TYPES.map(mt => (
          <option key={mt} value={mt}>{MAP_TYPE_LABELS[mt]}</option>
        ))}
      </select>

      {elapsedMs !== null && (
        <p className="elapsed">
          Last run: <strong>{elapsedMs.toFixed(2)} ms</strong>
        </p>
      )}
    </div>
  )
}
