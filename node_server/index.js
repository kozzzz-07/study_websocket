import http from "node:http";
import ws from "websocket";

const WebSocketServer = ws.server;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "accept-charset": "*",
    "access-control-allow-origin": "*",
  });
  res.end(
    JSON.stringify({
      data: "Hello World!",
    })
  );
});

server.listen(8080, () => {
  console.log("The http server is listening on port 8080");
});

// https://github.com/theturtle32/WebSocket-Node/blob/master/docs/WebSocketServer.md
let websocket = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false,
});

function isOriginAllowed(origin) {
  return true;
}

websocket.on("request", (req) => {
  if (!isOriginAllowed(req.origin)) {
    req.reject(403, "Sorry, you are not allowed here");
    console.log("Client's request rejected from origin" + req.origin);
    return;
  }

  const connection = req.accept(null, req.origin);
  connection.send("Connection established 🚀");
  console.log("Connection established and accepted");

  connection.on("message", (message) => {
    if (message.type === "utf8") {
      connection.send(
        `Ping: Message received from client: ${message.utf8Data}`
      );
    } else {
      connection.send(
        `Ping: Message received from client: ${message.binaryData}`
      );
    }
  });

  connection.on("close", (code, reason) => {
    console.log(
      `Peer connection ${connection.remoteAddress} disconnected. The reason is ${reason} and the closure code is ${code}`
    );
  });
});
