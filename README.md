# SIMPATH 4

**Path Planning Simulation Platform** — a desktop application for visualising and benchmarking path-planning algorithms on 2D grids and 3D voxel maps.

> Commercial software. A valid license key is required for production use.  
> Visit [roboticser.com/simpath](https://www.roboticser.com/simpath) to purchase.

---

## Features

- **2D grid planner** — obstacle painting, configurable grid size, multiple map types (GRID, GRAPH, SAMPLING, …)
- **3D voxel planner** — 3D navigation with altitude constraints (min/max hover height), sphere or box obstacles
- **Python plugin system** — drop in your own `.py` algorithm; hot-reload without restarting
- **Workspace save/load** — `.simpath` / `.simpath3d` files
- **Auto-update** — checks GitHub Releases on startup and installs silently

---

## Plugin API

Create a `.py` file with:

```python
MAP_TYPE = "GRID"          # GRID | GRAPH | SAMPLING | VOXEL | …

def find_path(grid, start, goal):
    # grid: list[list[int]]  (0 = free, 1 = obstacle)
    # start, goal: (row, col)
    # return: list of (row, col) tuples, or raise RuntimeError if unreachable
    ...
```

For 3D plugins use `MAP_TYPE = "VOXEL"` and:

```python
def find_path(grid, start, goal):
    # grid: list[list[list[int]]]  grid[x][y][z]
    # start, goal: (x, y, z)
    # return: list of (x, y, z) tuples
    ...
```

Upload via the **Plugins** panel in the app, or place the file in `methods/` (2D) or `methods3d/` (3D) and click **Reload**.

---

## Building from source

### Requirements

| Tool | Minimum version |
|------|----------------|
| CMake | 3.16 |
| GCC / Clang | C++17 |
| Boost | 1.74 (asio, beast, json) |
| OpenSSL | 1.1 |
| Python 3 dev headers | 3.9+ |
| pybind11 | 2.10 |
| Node.js | 22 |

### Quick start (Ubuntu / Debian)

```bash
# Install deps
sudo apt-get install -y cmake libboost-all-dev libssl-dev python3-dev libpybind11-dev

# Build engines + GUI
./setup.sh

# Run in dev mode
./run.sh
```

The `SIMPATH_HMAC_SECRET` CMake variable must be set to your private secret when building for production:

```bash
cmake -S . -B engine-build -DSIMPATH_HMAC_SECRET="your-secret-here"
```

Leave it unset for local/eval builds — the engine will use a placeholder secret that accepts only trial keys.

---

## License

[Proprietary](LICENSE) — see LICENSE file.  
Source published for reference and plugin authors.  
© 2025 Amir Ali Mokhtarzadeh
