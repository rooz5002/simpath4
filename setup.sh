#!/usr/bin/env bash
# SIMPATH 4 — setup script
# Supports Ubuntu 22.04 and 24.04
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PYTHON="${SIMPATH_PYTHON:-$(command -v python3)}"

echo "=== SIMPATH 4 setup ==="
echo "methods dir : ${SCRIPT_DIR}/methods"
echo "python      : ${VENV_PYTHON}"
echo "OS          : $(lsb_release -ds 2>/dev/null || uname -rs)"

# ── 1. System packages ───────────────────────────────────────────────────────
echo ""
echo "--- Checking system packages ---"

# Core packages available on both Ubuntu 22 and 24
CORE_PKGS=(cmake libboost-all-dev libssl-dev python3-dev python3-pip)
MISSING=()
for pkg in "${CORE_PKGS[@]}"; do
    dpkg -s "$pkg" &>/dev/null || MISSING+=("$pkg")
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
    echo "Installing: ${MISSING[*]}"
    sudo apt-get update -q
    sudo apt-get install -y "${MISSING[@]}"
else
    echo "Core packages present."
fi

# pybind11: package name differs across Ubuntu versions.
# libpybind11-dev exists on Ubuntu 24+; on 22 install via pip instead.
if ! python3 -c "import pybind11" &>/dev/null; then
    if apt-cache show libpybind11-dev &>/dev/null 2>&1; then
        echo "Installing libpybind11-dev..."
        sudo apt-get install -y libpybind11-dev
    else
        echo "Installing pybind11 via pip (Ubuntu 22 fallback)..."
        pip3 install --user pybind11
    fi
else
    echo "pybind11 already available."
fi

# ── 2. Node.js ───────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    echo ""
    echo "--- Installing Node.js 22 ---"
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js $(node --version) already installed."
fi

# ── 3. Build C++ engine ──────────────────────────────────────────────────────
echo ""
echo "--- Building C++ engine ---"
BUILD_DIR="${SCRIPT_DIR}/engine-build"
mkdir -p "${BUILD_DIR}"
cmake "${SCRIPT_DIR}" \
    -B "${BUILD_DIR}" \
    -DCMAKE_BUILD_TYPE=Release \
    -DSIMPATH_PYTHON="${VENV_PYTHON}"
cmake --build "${BUILD_DIR}" --parallel
echo "Engine binary: ${BUILD_DIR}/engine/simpath4_engine"

# ── 4. GUI npm install ───────────────────────────────────────────────────────
echo ""
echo "--- Installing GUI dependencies ---"
cd "${SCRIPT_DIR}/gui"
npm install

echo ""
echo "=== Setup complete. Run ./run.sh to start. ==="
