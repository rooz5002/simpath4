#include "Engine.h"
#include "server/WsServer.h"
#include <pybind11/embed.h>
#include <iostream>
#include <string>
#include <cstdlib>

namespace py = pybind11;

#ifndef SIMPATH_METHODS_DIR
#define SIMPATH_METHODS_DIR "../methods"
#endif

int main(int argc, char* argv[]) {
    unsigned short port = 8765;
    if (argc > 1) port = static_cast<unsigned short>(std::stoi(argv[1]));

    std::string methods_dir = SIMPATH_METHODS_DIR;
    if (argc > 2) methods_dir = argv[2];

    std::cout << "[simpath4] methods dir : " << methods_dir << "\n";
    std::cout << "[simpath4] WS port     : " << port << "\n";

    // pybind11 interpreter must remain alive for the entire process.
    py::scoped_interpreter guard{};

    Engine engine(methods_dir);

    WsServer server(port, [&](const std::string& msg) {
        return engine.handle(msg);
    });

    server.run();   // blocks forever
    return 0;
}
