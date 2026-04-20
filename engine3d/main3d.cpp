#include "Engine3D.h"
#include "server/WsServer.h"
#include <pybind11/embed.h>
#include <iostream>
#include <stdexcept>

namespace py = pybind11;

int main(int argc, char* argv[]) {
    unsigned short port        = 8766;
    std::string    methods_dir = "methods3d";

    if (argc > 1) port        = static_cast<unsigned short>(std::stoi(argv[1]));
    if (argc > 2) methods_dir = argv[2];

    std::cout << "[simpath4_3d] WS port     : " << port        << "\n";
    std::cout << "[simpath4_3d] methods dir : " << methods_dir << "\n";

    py::scoped_interpreter guard{};

    Engine3D engine(methods_dir);

    WsServer server(port, [&engine](const std::string& msg) {
        return engine.handle(msg);
    });

    server.run();
    return 0;
}
