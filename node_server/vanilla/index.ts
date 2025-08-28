import http from "node:http";

import * as CONSTANTS from "./lib/websocket_constants.ts";
// import * as methods from "./lib/websocket_methods.ts";

const http_server = http.createServer((req, res) => {
  // ws:// へのリクエストの場合、以下のコードは実行されない
  // 代わりに、そのリクエストは upgrade イベントリスナーに渡される
  // もし 'upgrade' イベントリスナーが存在しない場合は、エラーがスローされる
  res.writeHead(200);
  res.end(
    'Hello, I hope you enjoy the "under-the-hood" WebSocket implementation'
  );
});

http_server.listen(CONSTANTS.PORT, () => {
  console.log(`The http server is listening on port. ${CONSTANTS.PORT}`);
});

CONSTANTS.CUSTOM_ERRORS.forEach((errorEvents) => {
  process.on(errorEvents, (err) => {
    console.log(
      `My code caught an error event: ${errorEvents}. Here's the error object`,
      err
    );
    process.exit(1);
  });
});
