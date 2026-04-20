#include "Engine.h"
#include <boost/json.hpp>
#include <chrono>
#include <iostream>
#include <fstream>
#include <stdexcept>

namespace json = boost::json;
using namespace license;

// ── helpers ──────────────────────────────────────────────────────────────────

static std::string make_error(const std::string& msg) {
    json::object obj;
    obj["type"]    = "error";
    obj["message"] = msg;
    return json::serialize(obj);
}

// ── Engine ────────────────────────────────────────────────────────────────────

Engine::Engine(const std::string& methods_dir)
    : methods_dir_(methods_dir)
    , license_mgr_("SIMPATH4", SIMPATH_HMAC_SECRET)
    , gate_(license_mgr_.startup_check()) {
    registry_.scan(methods_dir_);
}

std::string Engine::handle(const std::string& json_msg) {
    json::value jv;
    try {
        jv = json::parse(json_msg);
    } catch (...) {
        return make_error("Invalid JSON");
    }

    auto& obj = jv.as_object();
    std::string type;
    try {
        type = std::string(obj.at("type").as_string());
    } catch (...) {
        return make_error("Missing 'type' field");
    }

    if (type == "ping")              return handle_ping();
    if (type == "list_algorithms")   return handle_list_algorithms();
    if (type == "set_grid")          return handle_set_grid(json_msg);
    if (type == "set_obstacle")      return handle_set_obstacle(json_msg);
    if (type == "find_path")         return handle_find_path(json_msg);
    if (type == "get_license")       return handle_get_license();
    if (type == "activate_license")  return handle_activate_license(json_msg);
    if (type == "upload_plugin")     return handle_upload_plugin(json_msg);
    if (type == "reload_plugins")    return handle_reload_plugins();

    return make_error("Unknown message type: " + type);
}

// ── handlers ──────────────────────────────────────────────────────────────────

std::string Engine::handle_ping() {
    return R"({"type":"pong"})";
}

std::string Engine::handle_list_algorithms() {
    json::object resp;
    resp["type"] = "algorithms";

    // Backward-compat "names" array
    json::array names;
    // Rich "algorithms" array: [{name, map_type}, ...]
    json::array algos;

    for (const auto& info : registry_.algorithm_infos()) {
        names.push_back(json::value(info.name));
        json::object entry;
        entry["name"]     = info.name;
        entry["map_type"] = map_type_to_string(info.map_type);
        algos.push_back(entry);
    }

    resp["names"]      = names;
    resp["algorithms"] = algos;
    return json::serialize(resp);
}

std::string Engine::handle_set_grid(const std::string& json_msg) {
    try {
        auto jv  = json::parse(json_msg);
        auto& obj = jv.as_object();
        int rows = (int)obj.at("rows").as_int64();
        int cols = (int)obj.at("cols").as_int64();

        // Gate: grid size limit for TRIAL
        gate_.require_full_grid(rows, cols);

        map_.resize(rows, cols);

        if (obj.contains("cells")) {
            const auto& cells = obj.at("cells").as_array();
            for (int x = 0; x < rows && x < (int)cells.size(); ++x) {
                const auto& row = cells[x].as_array();
                for (int y = 0; y < cols && y < (int)row.size(); ++y)
                    map_.set_cell(x, y, (int)row[y].as_int64());
            }
        }

        json::object resp;
        resp["type"] = "grid_ack";
        resp["rows"] = rows;
        resp["cols"] = cols;
        return json::serialize(resp);
    } catch (const std::exception& e) {
        return make_error(std::string("set_grid: ") + e.what());
    }
}

std::string Engine::handle_set_obstacle(const std::string& json_msg) {
    try {
        auto jv   = json::parse(json_msg);
        auto& obj = jv.as_object();
        int x     = (int)obj.at("x").as_int64();
        int y     = (int)obj.at("y").as_int64();
        int value = (int)obj.at("value").as_int64();
        map_.set_cell(x, y, value);
        return R"({"type":"obstacle_ack"})";
    } catch (const std::exception& e) {
        return make_error(std::string("set_obstacle: ") + e.what());
    }
}

std::string Engine::handle_find_path(const std::string& json_msg) {
    try {
        // Gate: planning requires at least TRIAL
        gate_.require_planning();

        auto jv       = json::parse(json_msg);
        auto& obj     = jv.as_object();
        std::string algo = std::string(obj.at("algorithm").as_string());

        // Gate: ML algorithms require ML tier
        if (algo == "dl_augmented_a_star")
            gate_.require_ml();

        const auto& sa = obj.at("start").as_array();
        const auto& ga = obj.at("goal").as_array();
        Point start = { (int)sa[0].as_int64(), (int)sa[1].as_int64() };
        Point goal  = { (int)ga[0].as_int64(), (int)ga[1].as_int64() };

        IPathPlanner* planner = registry_.get(algo);
        if (!planner)
            return make_error("Unknown algorithm: " + algo);

        auto t0     = std::chrono::high_resolution_clock::now();
        PathResult pr = planner->find_path(map_, start, goal);
        auto t1     = std::chrono::high_resolution_clock::now();
        double ms   = std::chrono::duration<double, std::milli>(t1 - t0).count();

        json::object resp;
        resp["type"]       = "path";
        resp["algorithm"]  = algo;
        resp["map_type"]   = map_type_to_string(planner->map_type());
        resp["elapsed_ms"] = ms;

        json::array jpath;
        for (const auto& pt : pr.path) {
            json::array p;
            p.push_back(pt.first);
            p.push_back(pt.second);
            jpath.push_back(p);
        }
        resp["path"] = jpath;

        if (pr.viz.has_value())
            resp["viz"] = pr.viz.value();

        return json::serialize(resp);

    } catch (const std::exception& e) {
        return make_error(std::string("find_path: ") + e.what());
    }
}

std::string Engine::handle_get_license() {
    const auto& r = gate_.current();
    json::object resp;
    resp["type"]          = "license_status";
    resp["valid"]         = r.valid;
    resp["tier"]          = tier_to_string(r.tier);
    resp["issued_date"]   = r.issued_date;
    resp["machine_bound"] = r.machine_bound;
    resp["message"]       = r.message;
    return json::serialize(resp);
}

std::string Engine::handle_reload_plugins() {
    registry_.scan(methods_dir_);
    return handle_list_algorithms();
}

std::string Engine::handle_upload_plugin(const std::string& json_msg) {
    try {
        auto jv  = json::parse(json_msg);
        auto& obj = jv.as_object();
        std::string filename = std::string(obj.at("filename").as_string());
        std::string content  = std::string(obj.at("content").as_string());

        // Security: reject any path traversal attempt
        if (filename.find('/') != std::string::npos ||
            filename.find('\\') != std::string::npos ||
            filename.find("..") != std::string::npos) {
            return make_error("Invalid plugin filename (no path separators allowed)");
        }
        if (filename.size() < 4 ||
            filename.substr(filename.size() - 3) != ".py") {
            return make_error("Plugin filename must end in .py");
        }

        // Write to methods directory
        std::string dest = methods_dir_ + "/" + filename;
        std::ofstream out(dest);
        if (!out.is_open())
            return make_error("Cannot write to methods directory: " + dest);
        out << content;
        out.close();

        std::cout << "[Engine] Plugin saved: " << dest << "\n";

        // Rescan and return updated algorithm list
        registry_.scan(methods_dir_);
        return handle_list_algorithms();

    } catch (const std::exception& e) {
        return make_error(std::string("upload_plugin: ") + e.what());
    }
}

std::string Engine::handle_activate_license(const std::string& json_msg) {
    try {
        auto jv  = json::parse(json_msg);
        auto& obj = jv.as_object();
        std::string key = std::string(obj.at("key").as_string());

        LicenseResult result = license_mgr_.validate(key);
        if (result.valid) {
            license_mgr_.save_cache(key);
            gate_.set_license(result);
            std::cout << "[License] Activated: " << result.message << "\n";
        }

        json::object resp;
        resp["type"]          = "license_status";
        resp["valid"]         = result.valid;
        resp["tier"]          = tier_to_string(result.tier);
        resp["issued_date"]   = result.issued_date;
        resp["machine_bound"] = result.machine_bound;
        resp["message"]       = result.message;
        return json::serialize(resp);

    } catch (const std::exception& e) {
        return make_error(std::string("activate_license: ") + e.what());
    }
}
