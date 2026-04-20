#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill any leftover engine processes
pkill -f simpath4_engine 2>/dev/null; sleep 0.5

# Start engines from the shell (not from inside Electron's SNAP sandbox)
echo "Starting 2D engine..."
"${SCRIPT_DIR}/engine-build/engine/simpath4_engine" 8765 "${SCRIPT_DIR}/methods" &
PID2D=$!

echo "Starting 3D engine..."
"${SCRIPT_DIR}/engine-build/engine3d/simpath4_engine3d" 8766 "${SCRIPT_DIR}/methods3d" &
PID3D=$!

sleep 2

# Launch Electron (engines already running — it will skip spawning its own)
cd "${SCRIPT_DIR}/gui"
SIMPATH_ENGINES_EXTERNAL=1 npm run build && \
SIMPATH_ENGINES_EXTERNAL=1 npm run electron:compile && \
SIMPATH_ENGINES_EXTERNAL=1 npx electron . --no-sandbox

# Clean up engines when Electron exits
kill $PID2D $PID3D 2>/dev/null
