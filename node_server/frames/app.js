import http from "node:http";
import { WebSocketServer } from "ws";

const server = http.createServer((req, res) => {
  if (req.url === "/hello") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.write("he");
    res.write("ll");
    res.end("o");
  } else {
    res.statusCode = 404;
    res.end("Not found");
  }
});

// mount websocket server onto http server
const socket = new WebSocketServer({ server });

function heartbeat() {
  this.isClientAlive = true;
}

// handle ws connection request
socket.on("connection", (ws) => {
  ws.isClientAlive = true;
  ws.on("pong", heartbeat);

  console.log("WebSocket client connected");

  // send a ping every 10 seconds
  setInterval(() => {
    if (ws.isClientAlive === false) return ws.terminate();
    ws.isClientAlive = false;
    ws.ping();
  }, 10000);

  ws.on("message", (message) => {
    console.log(`Received message: ${message}`);
  });

  ws.send("hello");
  // immediately close ws connection
  // ws.close();

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

server.listen(8080, () => {
  console.log("Server running at http://localhost:8080/");
});
