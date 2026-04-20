#pragma once

#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <functional>
#include <string>

namespace beast     = boost::beast;
namespace websocket = beast::websocket;
namespace net       = boost::asio;
using tcp           = net::ip::tcp;

/**
 * Synchronous single-connection WebSocket server (Phase 1).
 *
 * Listens on the given port, accepts one connection at a time, and
 * calls the message handler for every text frame received.
 *
 * The handler returns a response string which is sent back to the client.
 */
class WsServer {
public:
    using MessageHandler = std::function<std::string(const std::string&)>;

    WsServer(unsigned short port, MessageHandler handler);

    /** Block and serve until the process is killed. */
    void run();

private:
    void accept_loop(tcp::acceptor& acceptor, net::io_context& ioc);
    void handle_session(websocket::stream<tcp::socket> ws);

    unsigned short  port_;
    MessageHandler  handler_;
};
