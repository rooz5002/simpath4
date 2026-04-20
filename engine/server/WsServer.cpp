#include "WsServer.h"
#include <iostream>

WsServer::WsServer(unsigned short port, MessageHandler handler)
    : port_(port), handler_(std::move(handler)) {}

void WsServer::run() {
    net::io_context ioc;
    tcp::acceptor acceptor{ioc, tcp::endpoint{tcp::v4(), port_}};
    acceptor.set_option(tcp::acceptor::reuse_address(true));
    std::cout << "[WsServer] Listening on ws://localhost:" << port_ << "\n";
    accept_loop(acceptor, ioc);
}

void WsServer::accept_loop(tcp::acceptor& acceptor, net::io_context& ioc) {
    while (true) {
        beast::error_code ec;
        tcp::socket socket{ioc};
        acceptor.accept(socket, ec);
        if (ec) {
            std::cerr << "[WsServer] accept error: " << ec.message() << "\n";
            continue;
        }
        websocket::stream<tcp::socket> ws{std::move(socket)};
        try {
            ws.accept(ec);
            if (ec) {
                std::cerr << "[WsServer] handshake error: " << ec.message() << "\n";
                continue;
            }
            handle_session(std::move(ws));
        } catch (const std::exception& e) {
            std::cerr << "[WsServer] session exception: " << e.what() << "\n";
        }
    }
}

void WsServer::handle_session(websocket::stream<tcp::socket> ws) {
    std::cout << "[WsServer] Client connected\n";
    beast::flat_buffer buffer;
    beast::error_code ec;

    while (true) {
        buffer.clear();
        ws.read(buffer, ec);
        if (ec == websocket::error::closed || ec == net::error::eof) {
            std::cout << "[WsServer] Client disconnected\n";
            break;
        }
        if (ec) {
            std::cerr << "[WsServer] read error: " << ec.message() << "\n";
            break;
        }

        std::string msg = beast::buffers_to_string(buffer.data());
        std::string response;
        try {
            response = handler_(msg);
        } catch (const std::exception& e) {
            response = std::string(R"({"type":"error","message":")") + e.what() + "\"}";
        }

        ws.write(net::buffer(response), ec);
        if (ec) {
            std::cerr << "[WsServer] write error: " << ec.message() << "\n";
            break;
        }
    }
}
