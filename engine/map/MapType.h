#pragma once
#include <string>

enum class MapType {
    GRID,
    GRAPH,
    SAMPLING,
    POTENTIAL_FIELD,
    TRAJECTORY,
    AGENT,
};

inline MapType map_type_from_string(const std::string& s) {
    if (s == "GRID")            return MapType::GRID;
    if (s == "GRAPH")           return MapType::GRAPH;
    if (s == "SAMPLING")        return MapType::SAMPLING;
    if (s == "POTENTIAL_FIELD") return MapType::POTENTIAL_FIELD;
    if (s == "TRAJECTORY")      return MapType::TRAJECTORY;
    if (s == "AGENT")           return MapType::AGENT;
    return MapType::GRID;  // safe default
}

inline std::string map_type_to_string(MapType t) {
    switch (t) {
        case MapType::GRID:            return "GRID";
        case MapType::GRAPH:           return "GRAPH";
        case MapType::SAMPLING:        return "SAMPLING";
        case MapType::POTENTIAL_FIELD: return "POTENTIAL_FIELD";
        case MapType::TRAJECTORY:      return "TRAJECTORY";
        case MapType::AGENT:           return "AGENT";
    }
    return "GRID";
}
