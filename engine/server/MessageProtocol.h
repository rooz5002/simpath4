#pragma once

/**
 * WebSocket JSON Protocol — Phase 1
 *
 * All messages are JSON objects with a "type" field.
 *
 * ── Client → Engine ─────────────────────────────────────────────────────────
 *
 * ping
 *   {}
 *
 * list_algorithms
 *   { "type": "list_algorithms" }
 *
 * set_grid
 *   { "type": "set_grid",
 *     "rows": <int>,
 *     "cols": <int>,
 *     "cells": [[<int>, ...], ...]   // rows × cols, 0=free 1=obstacle
 *   }
 *
 * set_obstacle
 *   { "type": "set_obstacle", "x": <int>, "y": <int>, "value": <int> }
 *
 * find_path
 *   { "type": "find_path",
 *     "algorithm": "<name>",
 *     "start": [x, y],
 *     "goal":  [x, y]
 *   }
 *
 * ── Engine → Client ─────────────────────────────────────────────────────────
 *
 * pong
 *   { "type": "pong" }
 *
 * algorithms
 *   { "type": "algorithms", "names": ["A_Star", "D_Star", ...] }
 *
 * grid_ack
 *   { "type": "grid_ack", "rows": <int>, "cols": <int> }
 *
 * path
 *   { "type": "path",
 *     "algorithm": "<name>",
 *     "path": [[x,y], ...],
 *     "elapsed_ms": <float>
 *   }
 *
 * error
 *   { "type": "error", "message": "<text>" }
 */
