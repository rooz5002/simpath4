#pragma once

#include "map/GridMap.h"
#include "map/MapType.h"
#include "planner/PlannerRegistry.h"
#include "license/LicenseManager.h"
#include "license/FeatureGate.h"
#include <string>

#ifndef SIMPATH_HMAC_SECRET
#define SIMPATH_HMAC_SECRET "CHANGE_ME_BEFORE_RELEASE_SIMPATH4_SECRET"
#endif

/**
 * Core engine: owns the grid, planner registry, and license gate.
 * Receives JSON text, dispatches to the right handler, returns JSON text.
 */
class Engine {
public:
    Engine(const std::string& methods_dir);

    /** Process one WebSocket message and return the response. */
    std::string handle(const std::string& json_msg);

    /** Current license result — for status queries. */
    const license::LicenseResult& license() const { return gate_.current(); }

private:
    std::string handle_ping();
    std::string handle_list_algorithms();
    std::string handle_set_grid(const std::string& json_msg);
    std::string handle_set_obstacle(const std::string& json_msg);
    std::string handle_find_path(const std::string& json_msg);
    std::string handle_get_license();
    std::string handle_activate_license(const std::string& json_msg);
    std::string handle_upload_plugin(const std::string& json_msg);
    std::string handle_reload_plugins();

    std::string              methods_dir_;
    GridMap                  map_;
    PlannerRegistry          registry_;
    license::LicenseManager  license_mgr_;
    license::FeatureGate     gate_;
};
