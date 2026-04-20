#pragma once

#include "IPathPlanner.h"
#include "../map/MapType.h"
#include <memory>
#include <string>
#include <vector>
#include <unordered_map>

/** Metadata returned per algorithm in the list_algorithms response. */
struct AlgorithmInfo {
    std::string name;
    MapType     map_type;
};

/**
 * Discovers and owns all IPathPlanner instances.
 *
 * On startup it scans SIMPATH_METHODS_DIR for .py files that expose a
 * find_path() function and wraps each in a PythonAdapter.
 */
class PlannerRegistry {
public:
    PlannerRegistry() = default;

    /**
     * Scan a directory for Python plugins and register them.
     * Safe to call multiple times (re-scans each time).
     */
    void scan(const std::string& methods_dir);

    /** List of registered algorithm names (for GUI dropdown). */
    std::vector<std::string> names() const;

    /** Full metadata for each registered algorithm. */
    std::vector<AlgorithmInfo> algorithm_infos() const;

    /**
     * Get a planner by name.
     * Returns nullptr if not found.
     */
    IPathPlanner* get(const std::string& name) const;

private:
    std::vector<std::unique_ptr<IPathPlanner>> planners_;
    std::unordered_map<std::string, IPathPlanner*> index_;
};
