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

// handle ws connection request
socket.on("connection", (ws) => {
  console.log("WebSocket client connected");

  ws.on("message", (message) => {
    console.log(`Received message: ${message}`);
  });

  ws.send("hello");
  // immediately close ws connection
  ws.close();

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

server.listen(8080, () => {
  console.log("Server running at http://localhost:8080/");
});
