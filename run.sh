#!/usr/bin/env bash
# SIMPATH 4 — start 2D + 3D engines and GUI dev server
# Usage: ./run.sh [2d-port [3d-port]]
set -euo pipefail

if ! command -v node &>/dev/null; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT2D="${1:-8765}"
PORT3D="${2:-8766}"

ENGINE2D="${SCRIPT_DIR}/engine-build/engine/simpath4_engine"
ENGINE3D="${SCRIPT_DIR}/engine-build/engine3d/simpath4_engine3d"
METHODS2D="${SCRIPT_DIR}/methods"
METHODS3D="${SCRIPT_DIR}/methods3d"

if [[ ! -f "${ENGINE2D}" ]]; then
    echo "2D engine not built. Run ./setup.sh first."
    exit 1
fi

echo "Starting 2D engine on port ${PORT2D} …"
"${ENGINE2D}" "${PORT2D}" "${METHODS2D}" &
PID2D=$!

if [[ -f "${ENGINE3D}" ]]; then
    echo "Starting 3D engine on port ${PORT3D} …"
    "${ENGINE3D}" "${PORT3D}" "${METHODS3D}" &
    PID3D=$!
else
    echo "3D engine not found — 3D mode will be unavailable."
    PID3D=""
fi

cleanup() {
    echo "Stopping engines…"
    kill "${PID2D}" 2>/dev/null || true
    [[ -n "${PID3D}" ]] && kill "${PID3D}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 0.5

echo "Starting GUI dev server …"
cd "${SCRIPT_DIR}/gui"
npm run dev
