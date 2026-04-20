'''
a Python module implementing Probabilistic Roadmap (PRM) for path planning. It generates a roadmap using random sampling and finds a feasible path using Dijkstra’s algorithm.

This module will:
Sample random points in the environment
Connect nearby points to form a roadmap
Use Dijkstra’s algorithm to find the shortest path

By Amir Ali Mokhtarzadeh 2025
'''




MAP_TYPE = "SAMPLING"

import numpy as np
import networkx as nx
import random

class PRM:
    def __init__(self, grid, num_samples=200, k=10):
        """
        Initialize PRM planner.
        :param grid: 2D list representing the environment (0 = free, 1 = obstacle)
        :param num_samples: Number of random samples for roadmap
        :param k: Number of nearest neighbors to connect in roadmap
        """
        self.grid = np.array(grid)
        self.num_samples = num_samples
        self.k = k
        self.graph = nx.Graph()
        self.samples = []
    
    def is_valid(self, x, y):
        """Check if a point is within bounds and not an obstacle."""
        rows, cols = self.grid.shape
        return 0 <= x < rows and 0 <= y < cols and self.grid[x, y] == 0
    
    def sample_points(self):
        """Generate random valid points for the roadmap."""
        rows, cols = self.grid.shape
        while len(self.samples) < self.num_samples:
            x, y = random.randint(0, rows-1), random.randint(0, cols-1)
            if self.is_valid(x, y):
                self.samples.append((x, y))
    
    def distance(self, p1, p2):
        """Calculate Euclidean distance between two points."""
        return np.linalg.norm(np.array(p1) - np.array(p2))
    
    def build_roadmap(self):
        """Connect sampled points to form a graph."""
        self.sample_points()
        for i, p1 in enumerate(self.samples):
            distances = [(self.distance(p1, p2), p2) for p2 in self.samples if p1 != p2]
            distances.sort()
            for _, p2 in distances[:self.k]:
                if self.is_valid_path(p1, p2):
                    self.graph.add_edge(p1, p2, weight=self.distance(p1, p2))
    
    def is_valid_path(self, p1, p2):
        """Check if a straight-line path between two points is collision-free."""
        x1, y1 = p1
        x2, y2 = p2
        points = zip(np.linspace(x1, x2, num=20, dtype=int), np.linspace(y1, y2, num=20, dtype=int))
        return all(self.is_valid(x, y) for x, y in points)
    
    def find_path(self, start, goal):
        '''
        Find the shortest path using Dijkstra's algorithm.
        :param start: Start coordinate (x, y)
        :param goal: Goal coordinate (x, y)
        :return: List of waypoints from start to goal or None if no path found
        '''
        if not self.is_valid(start[0], start[1]) or not self.is_valid(goal[0], goal[1]):
            return None

        self.build_roadmap()  # Build the probabilistic roadmap before searching
        self.samples.append(start)
        self.samples.append(goal)
        self.graph.add_node(start)
        self.graph.add_node(goal)
        
        for p in self.samples:
            if self.is_valid_path(start, p):
                self.graph.add_edge(start, p, weight=self.distance(start, p))
            if self.is_valid_path(goal, p):
                self.graph.add_edge(goal, p, weight=self.distance(goal, p))
        
        try:
            path = nx.shortest_path(self.graph, source=start, target=goal, weight='weight')
            return path
        except nx.NetworkXNoPath:
            return None


def find_path(grid, start, goal):
    planner = PRM(grid)
    path = planner.find_path(start, goal)
    if not path:
        raise RuntimeError("PRM: No path found!")
    return path
