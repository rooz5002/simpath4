#include "PlannerRegistry.h"
#include "PythonAdapter.h"
#include <pybind11/embed.h>
#include <filesystem>
#include <iostream>

namespace py = pybind11;
namespace fs = std::filesystem;

void PlannerRegistry::scan(const std::string& methods_dir) {
    planners_.clear();
    index_.clear();

    fs::path dir(methods_dir);
    if (!fs::exists(dir) || !fs::is_directory(dir)) {
        std::cerr << "[PlannerRegistry] methods dir not found: " << methods_dir << "\n";
        return;
    }

    // Add methods_dir to Python sys.path so modules can be imported by name
    py::module_ sys = py::module_::import("sys");
    py::list path   = sys.attr("path");
    std::string abs_dir = fs::absolute(dir).string();

    bool already_in_path = false;
    for (auto item : path) {
        if (item.cast<std::string>() == abs_dir) { already_in_path = true; break; }
    }
    if (!already_in_path)
        path.insert(0, abs_dir);

    for (const auto& entry : fs::directory_iterator(dir)) {
        if (entry.path().extension() != ".py") continue;

        std::string stem = entry.path().stem().string();
        if (stem.empty() || stem[0] == '_') continue;  // skip __init__ etc.

        // Check the module actually has find_path before registering
        try {
            py::module_ mod = py::module_::import(stem.c_str());
            if (!py::hasattr(mod, "find_path")) {
                std::cout << "[PlannerRegistry] skip " << stem
                          << " (no find_path)\n";
                continue;
            }
        } catch (const py::error_already_set& e) {
            std::cerr << "[PlannerRegistry] import error for " << stem
                      << ": " << e.what() << "\n";
            continue;
        }

        try {
            auto adapter = std::make_unique<PythonAdapter>(stem);
            index_[stem] = adapter.get();
            planners_.push_back(std::move(adapter));
            std::cout << "[PlannerRegistry] registered: " << stem << "\n";
        } catch (const std::exception& e) {
            std::cerr << "[PlannerRegistry] failed to wrap " << stem
                      << ": " << e.what() << "\n";
        }
    }

    std::cout << "[PlannerRegistry] " << planners_.size()
              << " planners loaded\n";
}

std::vector<std::string> PlannerRegistry::names() const {
    std::vector<std::string> result;
    result.reserve(planners_.size());
    for (const auto& p : planners_)
        result.push_back(p->name());
    return result;
}

std::vector<AlgorithmInfo> PlannerRegistry::algorithm_infos() const {
    std::vector<AlgorithmInfo> result;
    result.reserve(planners_.size());
    for (const auto& p : planners_)
        result.push_back({ p->name(), p->map_type() });
    return result;
}

IPathPlanner* PlannerRegistry::get(const std::string& name) const {
    auto it = index_.find(name);
    return it != index_.end() ? it->second : nullptr;
}
