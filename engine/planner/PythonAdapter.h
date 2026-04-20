#pragma once

#include "IPathPlanner.h"
#include <pybind11/embed.h>
#include <string>

namespace py = pybind11;

/**
 * Wraps a Python module that exposes find_path(grid, start, goal).
 *
 * The module is imported once and cached. The GridMap is converted to a
 * Python list-of-lists using the same grid[x][y] convention.
 *
 * Plugins may optionally declare:
 *   MAP_TYPE = "GRID" | "GRAPH" | "SAMPLING" | ...
 * and return either a plain list of points or a dict:
 *   {"path": [...], "viz": {...}}
 */
class PythonAdapter : public IPathPlanner {
public:
    /**
     * @param module_name  Python module name (e.g. "A_Star")
     * @param display_name Name shown in GUI (defaults to module_name)
     */
    PythonAdapter(const std::string& module_name,
                  const std::string& display_name = "");

    std::string name()     const override { return display_name_; }
    MapType     map_type() const override { return map_type_; }

    PathResult find_path(const GridMap& map, Point start, Point goal) override;

private:
    std::string  module_name_;
    std::string  display_name_;
    MapType      map_type_ = MapType::GRID;
    py::module_  module_;
};
