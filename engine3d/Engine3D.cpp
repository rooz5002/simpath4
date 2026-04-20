#include "Engine3D.h"
#include <boost/json.hpp>
#include <pybind11/stl.h>
#include <filesystem>
#include <fstream>
#include <chrono>
#include <iostream>

namespace json = boost::json;
namespace py   = pybind11;
namespace fs   = std::filesystem;

static std::string make_error(const std::string& msg) {
    json::object o; o["type"]="error"; o["message"]=msg;
    return json::serialize(o);
}

static double json_to_double(const json::value& v) {
    if (v.is_double())  return v.as_double();
    if (v.is_int64())   return (double)v.as_int64();
    return (double)v.as_uint64();
}

// ── Engine3D ──────────────────────────────────────────────────────────────────

Engine3D::Engine3D(const std::string& methods_dir)
    : methods_dir_(methods_dir) {
    map_.resize(10, 10, 6);
    z_max_ = map_.zs() - 1;
    scan_plugins(methods_dir_);
}

void Engine3D::scan_plugins(const std::string& dir) {
    plugins_.clear();
    index_.clear();

    fs::path d(dir);
    if (!fs::exists(d)) {
        std::cerr << "[Engine3D] methods dir not found: " << dir << "\n";
        return;
    }

    py::module_ sys = py::module_::import("sys");
    py::list path   = sys.attr("path");
    std::string abs = fs::absolute(d).string();
    bool found = false;
    for (auto item : path)
        if (item.cast<std::string>() == abs) { found=true; break; }
    if (!found) path.insert(0, abs);

    for (const auto& entry : fs::directory_iterator(d)) {
        if (entry.path().extension() != ".py") continue;
        std::string stem = entry.path().stem().string();
        if (stem.empty() || stem[0]=='_') continue;
        try {
            py::module_ mod = py::module_::import(stem.c_str());
            if (!py::hasattr(mod, "find_path")) continue;
            std::string mt = "VOXEL";
            if (py::hasattr(mod, "MAP_TYPE"))
                mt = mod.attr("MAP_TYPE").cast<std::string>();
            if (mt != "VOXEL") continue;
            plugins_.push_back({stem, mod});
            index_[stem] = &plugins_.back();
            std::cout << "[Engine3D] registered: " << stem << "\n";
        } catch (const py::error_already_set& e) {
            std::cerr << "[Engine3D] import error " << stem << ": " << e.what() << "\n";
        }
    }
    std::cout << "[Engine3D] " << plugins_.size() << " plugin(s)\n";
}

std::string Engine3D::handle(const std::string& msg) {
    json::value jv;
    try { jv = json::parse(msg); } catch (...) { return make_error("Invalid JSON"); }
    std::string type;
    try { type = std::string(jv.as_object().at("type").as_string()); }
    catch (...) { return make_error("Missing 'type'"); }

    if (type=="ping")                return handle_ping();
    if (type=="list_algorithms")     return handle_list_algorithms();
    if (type=="set_grid")            return handle_set_grid(msg);
    if (type=="generate_obstacles")  return handle_generate_obstacles(msg);
    if (type=="set_obstacles_bulk")  return handle_set_obstacles_bulk(msg);
    if (type=="set_height_limits")   return handle_set_height_limits(msg);
    if (type=="find_path")           return handle_find_path(msg);
    if (type=="get_grid")            return handle_get_grid();
    if (type=="upload_plugin")       return handle_upload_plugin(msg);
    if (type=="reload_plugins")      return handle_reload_plugins();
    return make_error("Unknown type: " + type);
}

// ── handlers ─────────────────────────────────────────────────────────────────

std::string Engine3D::handle_ping() { return R"({"type":"pong"})"; }

std::string Engine3D::handle_list_algorithms() {
    json::object resp;
    resp["type"] = "algorithms";
    json::array names, algos;
    for (const auto& p : plugins_) {
        names.push_back(json::value(p.name));
        json::object e; e["name"]=p.name; e["map_type"]="VOXEL";
        algos.push_back(e);
    }
    resp["names"]=""; resp["names"]=names;
    resp["algorithms"]=algos;
    return json::serialize(resp);
}

std::string Engine3D::handle_set_grid(const std::string& msg) {
    try {
        auto jv2=json::parse(msg); auto& obj=jv2.as_object();
        int xs=std::max(2,std::min((int)obj.at("xs").as_int64(),80));
        int ys=std::max(2,std::min((int)obj.at("ys").as_int64(),80));
        int zs=std::max(2,std::min((int)obj.at("zs").as_int64(),40));
        map_.resize(xs,ys,zs);
        z_max_ = zs-1;   // reset height limits to full range
        z_min_ = 0;
        json::object r; r["type"]="grid_ack"; r["xs"]=xs; r["ys"]=ys; r["zs"]=zs;
        return json::serialize(r);
    } catch(const std::exception& e){ return make_error(std::string("set_grid: ")+e.what()); }
}

std::string Engine3D::handle_generate_obstacles(const std::string& msg) {
    try {
        auto jv2=json::parse(msg); auto& obj=jv2.as_object();
        double pct = json_to_double(obj.at("density"));
        double d   = std::max(0.0,std::min(pct/100.0,0.95));

        // shape: "cube" (default) or "sphere"
        std::string shape = "cube";
        if (obj.contains("shape")) shape = std::string(obj.at("shape").as_string());

        int radius = 2;
        if (obj.contains("radius")) radius = std::max(1,(int)obj.at("radius").as_int64());

        map_.clear();
        last_obs_shape_ = shape;
        if (shape=="sphere")
            map_.generate_spheres(d, radius, sx_,sy_,sz_, gx_,gy_,gz_);
        else
            map_.generate_random(d, sx_,sy_,sz_, gx_,gy_,gz_);

        json::object r; r["type"]="obstacles_ack"; r["density"]=pct;
        return json::serialize(r);
    } catch(const std::exception& e){ return make_error(std::string("generate_obstacles: ")+e.what()); }
}

std::string Engine3D::handle_set_obstacles_bulk(const std::string& msg) {
    try {
        auto jv2=json::parse(msg); auto& obj=jv2.as_object();
        map_.clear();
        for (const auto& item : obj.at("obstacles").as_array()) {
            const auto& v=item.as_array();
            int x=(int)v[0].as_int64(), y=(int)v[1].as_int64(), z=(int)v[2].as_int64();
            int val=v.size()>3?(int)v[3].as_int64():1;
            if (map_.in_bounds(x,y,z)) map_.set(x,y,z,val);
        }
        return R"({"type":"obstacles_bulk_ack"})";
    } catch(const std::exception& e){ return make_error(std::string("set_obstacles_bulk: ")+e.what()); }
}

std::string Engine3D::handle_set_height_limits(const std::string& msg) {
    try {
        auto jv2=json::parse(msg); auto& obj=jv2.as_object();
        z_min_ = std::max(0,(int)obj.at("z_min").as_int64());
        z_max_ = std::min(map_.zs()-1,(int)obj.at("z_max").as_int64());
        if (z_min_>z_max_) z_min_=z_max_;
        json::object r; r["type"]="height_ack"; r["z_min"]=z_min_; r["z_max"]=z_max_;
        return json::serialize(r);
    } catch(const std::exception& e){ return make_error(std::string("set_height_limits: ")+e.what()); }
}

std::string Engine3D::handle_find_path(const std::string& msg) {
    try {
        auto jv2=json::parse(msg); auto& obj=jv2.as_object();
        std::string algo=std::string(obj.at("algorithm").as_string());
        const auto& sa=obj.at("start").as_array();
        const auto& ga=obj.at("goal").as_array();
        sx_=(int)sa[0].as_int64(); sy_=(int)sa[1].as_int64(); sz_=(int)sa[2].as_int64();
        gx_=(int)ga[0].as_int64(); gy_=(int)ga[1].as_int64(); gz_=(int)ga[2].as_int64();

        auto it=index_.find(algo);
        if (it==index_.end()) return make_error("Unknown algorithm: "+algo);

        // Build 3-D Python grid[x][y][z], masking outside height limits
        py::list py_grid;
        for (int x=0;x<map_.xs();++x){
            py::list plane;
            for (int y=0;y<map_.ys();++y){
                py::list col;
                for (int z=0;z<map_.zs();++z){
                    int val=map_.get(x,y,z);
                    if (z<z_min_||z>z_max_) val=1;  // enforce height limits
                    col.append(val);
                }
                plane.append(col);
            }
            py_grid.append(plane);
        }
        py::tuple py_start=py::make_tuple(sx_,sy_,sz_);
        py::tuple py_goal =py::make_tuple(gx_,gy_,gz_);

        auto t0=std::chrono::high_resolution_clock::now();
        py::object result;
        try { result=it->second->module.attr("find_path")(py_grid,py_start,py_goal); }
        catch(const py::error_already_set& e){ return make_error(std::string(e.what())); }
        auto t1=std::chrono::high_resolution_clock::now();
        double ms=std::chrono::duration<double,std::milli>(t1-t0).count();

        if (result.is_none()) return make_error(algo+": find_path returned None");

        json::array jpath;
        for (auto item:result){
            auto t=item.cast<py::tuple>();
            json::array pt;
            pt.push_back((int64_t)t[0].cast<int>());
            pt.push_back((int64_t)t[1].cast<int>());
            pt.push_back((int64_t)t[2].cast<int>());
            jpath.push_back(pt);
        }
        json::object r;
        r["type"]="path"; r["algorithm"]=algo; r["map_type"]="VOXEL";
        r["elapsed_ms"]=ms; r["path"]=jpath;
        return json::serialize(r);

    } catch(const std::exception& e){ return make_error(std::string("find_path: ")+e.what()); }
}

std::string Engine3D::handle_get_grid() {
    json::array obstacles;
    for (int x=0;x<map_.xs();++x)
    for (int y=0;y<map_.ys();++y)
    for (int z=0;z<map_.zs();++z)
        if (map_.get(x,y,z)!=0){
            json::array v;
            v.push_back((int64_t)x); v.push_back((int64_t)y); v.push_back((int64_t)z);
            obstacles.push_back(v);
        }
    json::object r;
    r["type"]="grid_state";
    r["xs"]=map_.xs(); r["ys"]=map_.ys(); r["zs"]=map_.zs();
    r["z_min"]=z_min_; r["z_max"]=z_max_;
    r["obstacle_shape"]=last_obs_shape_;
    r["obstacles"]=obstacles;
    return json::serialize(r);
}

std::string Engine3D::handle_upload_plugin(const std::string& msg) {
    try {
        auto jv2=json::parse(msg); auto& obj=jv2.as_object();
        std::string filename=std::string(obj.at("filename").as_string());
        std::string content =std::string(obj.at("content").as_string());
        if (filename.find('/')!=std::string::npos||
            filename.find('\\')!=std::string::npos||
            filename.find("..")!=std::string::npos)
            return make_error("Invalid plugin filename");
        if (filename.size()<4||filename.substr(filename.size()-3)!=".py")
            return make_error("Plugin filename must end in .py");
        std::string dest=methods_dir_+"/"+filename;
        std::ofstream out(dest);
        if (!out.is_open()) return make_error("Cannot write to methods3d dir");
        out<<content; out.close();
        scan_plugins(methods_dir_);
        return handle_list_algorithms();
    } catch(const std::exception& e){ return make_error(std::string("upload_plugin: ")+e.what()); }
}

std::string Engine3D::handle_reload_plugins() {
    scan_plugins(methods_dir_);
    return handle_list_algorithms();
}
