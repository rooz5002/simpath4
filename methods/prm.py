'''
Python implementation of the Probabilistic Roadmap Method (PRM) for path planning. 

PRM Class:

num_samples: Number of random samples to generate.

k: Number of nearest neighbors to connect for each sample.

samples: List of sampled points.

graph: Graph storing connections between samples.

kd_tree: KDTree for efficient nearest neighbor search.

Methods:

is_collision_free: Checks if a straight-line path between two points is collision-free.

generate_random_samples: Generates random samples in the free space of the grid.

build_graph: Connects samples to their k-nearest neighbors if the path is collision-free.

find_path: Finds a path from start to goal using A* search on the PRM graph.

A Search*:

Used to find the shortest path in the graph from the start to the goal.


By: Amir Ali Mokhtarzadeh
'''









MAP_TYPE = "SAMPLING"

import numpy as np
import random
import math
from scipy.spatial import KDTree

class PRM:
    def __init__(self, num_samples=100, k=5):
        self.num_samples = num_samples  # Number of random samples
        self.k = k  # Number of nearest neighbors to connect
        self.samples = []  # List to store sampled points
        self.graph = {}  # Graph to store connections
        self.kd_tree = None  # KDTree for efficient nearest neighbor search

    def is_collision_free(self, grid, p1, p2):
        """Check if the path between p1 and p2 is collision-free."""
        x1, y1 = p1
        x2, y2 = p2
        dx, dy = x2 - x1, y2 - y1
        dist = math.hypot(dx, dy)
        if dist == 0:
            return True
        for i in range(int(dist) + 1):
            x = x1 + dx * i / dist
            y = y1 + dy * i / dist
            # Grid uses grid[x][y] convention (x=col, y=row)
            if grid[int(x)][int(y)] != 0:  # != 0 catches static and moving obstacles
                return False
        return True

    def generate_random_samples(self, grid):
        """Generate unique random samples in the free space of the grid."""
        rows, cols = len(grid), len(grid[0])
        # Collect all free cells and sample from them (no duplicates)
        free_cells = [(x, y) for x in range(rows) for y in range(cols) if grid[x][y] == 0]
        n = min(self.num_samples, len(free_cells))
        self.samples = random.sample(free_cells, n)
        self.kd_tree = KDTree(self.samples)
        self.kd_tree = KDTree(self.samples)

    def build_graph(self, grid):
        """Build the graph by connecting samples to their k-nearest neighbors."""
        self.graph = {i: [] for i in range(len(self.samples))}
        for i, sample in enumerate(self.samples):
            # Dynamically adjust k to avoid exceeding the number of samples
            k = min(self.k + 1, len(self.samples))
            distances, indices = self.kd_tree.query(sample, k=k)
            for idx in indices[1:]:  # Skip the first index (itself)
                if self.is_collision_free(grid, sample, self.samples[idx]):
                    self.graph[i].append(idx)
                    self.graph[idx].append(i)

    def find_path(self, grid, start, goal):
        """Find a path from start to goal using PRM."""
        # Add start and goal if not already in samples
        if start not in self.samples:
            self.samples.append(start)
        if goal not in self.samples:
            self.samples.append(goal)
        self.kd_tree = KDTree(self.samples)

        # Connect start and goal to their nearest neighbors
        start_idx = self.samples.index(start)
        goal_idx = self.samples.index(goal)
        if start_idx not in self.graph:
            self.graph[start_idx] = []
        if goal_idx not in self.graph:
            self.graph[goal_idx] = []

        # Use larger k to ensure connectivity
        k = min(self.k + 2, len(self.samples))

        # Connect start
        distances, indices = self.kd_tree.query(start, k=k)
        for idx in indices:
            if int(idx) != start_idx and self.is_collision_free(grid, start, self.samples[int(idx)]):
                if int(idx) not in self.graph[start_idx]:
                    self.graph[start_idx].append(int(idx))
                if start_idx not in self.graph.get(int(idx), []):
                    self.graph.setdefault(int(idx), []).append(start_idx)

        # Connect goal
        distances, indices = self.kd_tree.query(goal, k=k)
        for idx in indices:
            if int(idx) != goal_idx and self.is_collision_free(grid, goal, self.samples[int(idx)]):
                if int(idx) not in self.graph[goal_idx]:
                    self.graph[goal_idx].append(int(idx))
                if goal_idx not in self.graph.get(int(idx), []):
                    self.graph.setdefault(int(idx), []).append(goal_idx)

        # Perform A* search to find the path
        def heuristic(a, b):
            return math.hypot(a[0] - b[0], a[1] - b[1])

        open_set = set([start_idx])
        came_from = {}
        g_score = {i: float('inf') for i in range(len(self.samples))}
        g_score[start_idx] = 0
        f_score = {i: float('inf') for i in range(len(self.samples))}
        f_score[start_idx] = heuristic(self.samples[start_idx], self.samples[goal_idx])

        while open_set:
            current = min(open_set, key=lambda x: f_score[x])
            if current == goal_idx:
                path = []
                while current in came_from:
                    path.append(self.samples[current])
                    current = came_from[current]
                path.append(self.samples[start_idx])
                return path[::-1]

            open_set.remove(current)
            for neighbor in self.graph[current]:
                tentative_g_score = g_score[current] + heuristic(self.samples[current], self.samples[neighbor])
                if tentative_g_score < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    f_score[neighbor] = tentative_g_score + heuristic(self.samples[neighbor], self.samples[goal_idx])
                    if neighbor not in open_set:
                        open_set.add(neighbor)

        return None  # No path found
'''
# Example usage
if __name__ == "__main__":
    grid = [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0],
        [0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0],
        [0, 0, 0, 0, 0]
    ]
    start = (0, 0)
    goal = (4, 4)

    prm = PRM(num_samples=50, k=5)
    prm.generate_random_samples(grid)
    prm.build_graph(grid)
    path = prm.find_path(grid, start, goal)

    if path:
        print("Path found:", path)
    else:
        print("No path found.")
'''
def find_path(grid, start, goal):
    prm = PRM(num_samples=200, k=10)
    prm.generate_random_samples(grid)
    prm.build_graph(grid)
    path = prm.find_path(grid, start, goal)
    if not path:
        raise RuntimeError("PRM: No path found!")

    # Build edge list for visualisation (deduplicated)
    seen = set()
    edges = []
    for node_i, neighbours in prm.graph.items():
        for node_j in neighbours:
            key = (min(node_i, node_j), max(node_i, node_j))
            if key not in seen:
                seen.add(key)
                edges.append([node_i, node_j])

    return {
        "path": path,
        "viz": {
            "samples": [list(s) for s in prm.samples],
            "edges":   edges,
        }
    }


