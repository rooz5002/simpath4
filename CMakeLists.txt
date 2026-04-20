cmake_minimum_required(VERSION 3.16)
project(simpath4_engine VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ── Python interpreter ──────────────────────────────────────────────────────
# Pass via: cmake -DSIMPATH_PYTHON=/path/to/python3
if(DEFINED SIMPATH_PYTHON)
    set(Python3_EXECUTABLE "${SIMPATH_PYTHON}")
endif()
find_package(Python3 REQUIRED COMPONENTS Interpreter Development)

# ── pybind11 ────────────────────────────────────────────────────────────────
find_package(pybind11 REQUIRED)

# ── Boost ────────────────────────────────────────────────────────────────────
# boost_json is a proper cmake component from Boost 1.75+.
# On Ubuntu 22 (Boost 1.74) it is header-only — no separate target needed.
find_package(Boost 1.74 REQUIRED COMPONENTS system)
if(Boost_VERSION_STRING VERSION_GREATER_EQUAL "1.75.0")
    find_package(Boost 1.75 REQUIRED COMPONENTS json)
    set(BOOST_JSON_LIB Boost::json)
else()
    set(BOOST_JSON_LIB "")   # header-only in 1.74, included via Boost::system
endif()

# ── OpenSSL (Beast TLS support, even if unused in Phase 1) ──────────────────
find_package(OpenSSL REQUIRED)

# ── Subdirectory ────────────────────────────────────────────────────────────
add_subdirectory(engine)
add_subdirectory(engine3d)
