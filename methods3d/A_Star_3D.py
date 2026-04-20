'''
3D A* path planner for a hovering robot in a voxel environment.

grid[x][y][z] = 0 (free) | 1 (obstacle)
start = (x, y, z)
goal  = (x, y, z)

26-connected neighbourhood (face + edge + corner neighbours).

By Amir Ali Mokhtarzadeh 2025
'''

MAP_TYPE = "VOXEL"

import heapq
import math

def find_path(grid, start, goal):
    X = len(grid)
    Y = len(grid[0])
    Z = len(grid[0][0])

    def free(x, y, z):
        return 0 <= x < X and 0 <= y < Y and 0 <= z < Z and grid[x][y][z] == 0

    def h(a, b):
        return math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2)

    # 26 neighbours (all combinations of -1/0/+1 except (0,0,0))
    DIRS = [
        (dx, dy, dz)
        for dx in (-1, 0, 1)
        for dy in (-1, 0, 1)
        for dz in (-1, 0, 1)
        if not (dx == 0 and dy == 0 and dz == 0)
    ]
    COSTS = [math.sqrt(dx*dx + dy*dy + dz*dz) for dx, dy, dz in DIRS]

    start = tuple(start)
    goal  = tuple(goal)

    if not free(*start):
        raise RuntimeError("A_Star_3D: start position is blocked.")
    if not free(*goal):
        raise RuntimeError("A_Star_3D: goal position is blocked.")

    open_set  = [(h(start, goal), 0.0, start)]
    came_from = {}
    g_score   = {start: 0.0}

    while open_set:
        f, g, cur = heapq.heappop(open_set)

        if cur == goal:
            path = []
            while cur in came_from:
                path.append(list(cur))
                cur = came_from[cur]
            path.append(list(start))
            return path[::-1]

        if g > g_score.get(cur, float('inf')) + 1e-9:
            continue   # stale entry

        x, y, z = cur
        for (dx, dy, dz), cost in zip(DIRS, COSTS):
            nb = (x+dx, y+dy, z+dz)
            if not free(*nb):
                continue
            ng = g_score[cur] + cost
            if ng < g_score.get(nb, float('inf')):
                g_score[nb]   = ng
                came_from[nb] = cur
                heapq.heappush(open_set, (ng + h(nb, goal), ng, nb))

    raise RuntimeError("A_Star_3D: No path found!")
