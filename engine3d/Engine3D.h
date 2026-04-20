#pragma once
#include "GridMap3D.h"
#include <pybind11/embed.h>
#include <string>
#include <vector>
#include <unordered_map>

namespace py = pybind11;

struct Plugin3D {
    std::string name;
    py::module_ module;
};

class Engine3D {
public:
    Engine3D(const std::string& methods_dir);
    std::string handle(const std::string& json_msg);

private:
    std::string handle_ping();
    std::string handle_list_algorithms();
    std::string handle_set_grid(const std::string& msg);
    std::string handle_generate_obstacles(const std::string& msg);
    std::string handle_set_obstacles_bulk(const std::string& msg);
    std::string handle_set_height_limits(const std::string& msg);
    std::string handle_find_path(const std::string& msg);
    std::string handle_get_grid();
    std::string handle_upload_plugin(const std::string& msg);
    std::string handle_reload_plugins();

    void scan_plugins(const std::string& dir);

    std::string methods_dir_;
    GridMap3D   map_;

    // Stored start/goal so generate_obstacles keeps them free
    int sx_=0, sy_=0, sz_=0;
    int gx_=1, gy_=1, gz_=1;

    // Hovering height limits (inclusive Z range)
    int z_min_ = 0;
    int z_max_ = 999;   // effectively unlimited until set

    // Last obstacle generation shape
    std::string last_obs_shape_ = "box";

    std::vector<Plugin3D>                      plugins_;
    std::unordered_map<std::string, Plugin3D*> index_;
};
