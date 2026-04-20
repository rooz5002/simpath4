#include "PythonAdapter.h"
#include <pybind11/stl.h>
#include <stdexcept>
#include <iostream>

namespace py = pybind11;
namespace json = boost::json;

// ── Python → Boost.JSON conversion ───────────────────────────────────────────

static json::value py_to_json(const py::handle& obj) {
    if (obj.is_none())                         return nullptr;
    if (py::isinstance<py::bool_>(obj))        return obj.cast<bool>();
    if (py::isinstance<py::int_>(obj))         return obj.cast<std::int64_t>();
    if (py::isinstance<py::float_>(obj))       return obj.cast<double>();
    if (py::isinstance<py::str>(obj))          return json::value(obj.cast<std::string>());
    if (py::isinstance<py::dict>(obj)) {
        json::object jobj;
        for (auto& kv : obj.cast<py::dict>())
            jobj[kv.first.cast<std::string>()] = py_to_json(kv.second);
        return jobj;
    }
    if (py::isinstance<py::sequence>(obj)) {
        json::array jarr;
        for (auto item : obj.cast<py::sequence>())
            jarr.push_back(py_to_json(item));
        return jarr;
    }
    // Fallback: stringify
    return json::value(std::string(py::str(obj)));
}

// ── PythonAdapter ─────────────────────────────────────────────────────────────

PythonAdapter::PythonAdapter(const std::string& module_name,
                             const std::string& display_name)
    : module_name_(module_name),
      display_name_(display_name.empty() ? module_name : display_name) {
    try {
        module_ = py::module_::import(module_name_.c_str());
    } catch (const py::error_already_set& e) {
        throw std::runtime_error("PythonAdapter: cannot import '" +
                                 module_name_ + "': " + e.what());
    }

    // Read MAP_TYPE attribute if declared by the plugin
    if (py::hasattr(module_, "MAP_TYPE")) {
        try {
            std::string mt = module_.attr("MAP_TYPE").cast<std::string>();
            map_type_ = map_type_from_string(mt);
            std::cout << "[PythonAdapter] " << module_name_
                      << " map_type=" << mt << "\n";
        } catch (...) {
            std::cerr << "[PythonAdapter] " << module_name_
                      << ": MAP_TYPE attribute is not a string, defaulting to GRID\n";
        }
    }
}

PathResult PythonAdapter::find_path(const GridMap& map, Point start, Point goal) {
    // Convert GridMap to Python list[list[int]]
    py::list py_grid;
    for (int x = 0; x < map.rows(); ++x) {
        py::list row;
        for (int y = 0; y < map.cols(); ++y)
            row.append(map.get_cell(x, y));
        py_grid.append(row);
    }

    py::tuple py_start = py::make_tuple(start.first, start.second);
    py::tuple py_goal  = py::make_tuple(goal.first,  goal.second);

    py::object result;
    try {
        result = module_.attr("find_path")(py_grid, py_start, py_goal);
    } catch (const py::error_already_set& e) {
        throw std::runtime_error(std::string(e.what()));
    }

    if (result.is_none())
        throw std::runtime_error(module_name_ + ": find_path returned None");

    PathResult out;

    // Plugin returns either:
    //   (a) list of (x,y) tuples   — backward-compatible
    //   (b) dict {"path": [...], "viz": {...}}
    if (py::isinstance<py::dict>(result)) {
        py::dict d = result.cast<py::dict>();

        if (!d.contains("path"))
            throw std::runtime_error(module_name_ + ": dict result missing 'path' key");

        py::object path_obj = d["path"];
        for (auto item : path_obj) {
            auto tup = item.cast<py::tuple>();
            out.path.emplace_back(tup[0].cast<int>(), tup[1].cast<int>());
        }

        if (d.contains("viz") && !d["viz"].is_none())
            out.viz = py_to_json(d["viz"]);

    } else {
        // Plain sequence of (x,y) points
        for (auto item : result) {
            auto tup = item.cast<py::tuple>();
            out.path.emplace_back(tup[0].cast<int>(), tup[1].cast<int>());
        }
    }

    return out;
}
