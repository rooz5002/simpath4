add_executable(simpath4_engine
    main.cpp
    Engine.cpp
    server/WsServer.cpp
    map/GridMap.cpp
    planner/PythonAdapter.cpp
    planner/PlannerRegistry.cpp
    license/MachineId.cpp
    license/LicenseManager.cpp
    license/FeatureGate.cpp
)

target_include_directories(simpath4_engine PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${Python3_INCLUDE_DIRS}
)

target_link_libraries(simpath4_engine PRIVATE
    Boost::system
    ${BOOST_JSON_LIB}
    OpenSSL::SSL
    OpenSSL::Crypto
    pybind11::embed
    ${Python3_LIBRARIES}
)

# Path to methods/ directory — embedded as compile definition so the engine
# can locate Python plugins at runtime.
target_compile_definitions(simpath4_engine PRIVATE
    SIMPATH_METHODS_DIR="${CMAKE_SOURCE_DIR}/../methods"
    SIMPATH_VENV_PYTHON="${Python3_EXECUTABLE}"
)
