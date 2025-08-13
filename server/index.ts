import http from "node:http";

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "accept-charset": "*",
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
