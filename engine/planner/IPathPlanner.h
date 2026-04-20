#pragma once

#include <vector>
#include <utility>
#include <string>
#include <optional>
#include <boost/json.hpp>
#include "../map/GridMap.h"
#include "../map/MapType.h"

using Point = std::pair<int, int>;
using Path  = std::vector<Point>;

/**
 * Result of a find_path call.
 *
 * viz is non-empty when the plugin returns extra visualisation data
 * (e.g. SAMPLING plugins return sampled nodes and roadmap edges).
 */
struct PathResult {
    Path path;
    std::optional<boost::json::value> viz;
};

/**
 * Interface for all path planners (Phase 1: Python-backed; later: native C++).
 */
class IPathPlanner {
public:
    virtual ~IPathPlanner() = default;

    /** Human-readable name shown in the GUI dropdown. */
    virtual std::string name() const = 0;

    /** Map representation this planner expects (drives canvas rendering). */
    virtual MapType map_type() const = 0;

    /**
     * Compute a path from start to goal on the given grid.
     * Throws std::runtime_error if no path is found.
     */
    virtual PathResult find_path(const GridMap& map, Point start, Point goal) = 0;
};
