add_executable(simpath4_engine3d
    main3d.cpp
    Engine3D.cpp
    GridMap3D.cpp
    server/WsServer.cpp
)

target_include_directories(simpath4_engine3d PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${Python3_INCLUDE_DIRS}
)

target_link_libraries(simpath4_engine3d PRIVATE
    Boost::system
    Boost::json
    OpenSSL::SSL
    OpenSSL::Crypto
    pybind11::embed
    ${Python3_LIBRARIES}
)

target_compile_definitions(simpath4_engine3d PRIVATE
    SIMPATH_METHODS3D_DIR="${CMAKE_SOURCE_DIR}/../methods3d"
)
