import http from "node:http";
import stream from "node:stream";

import * as CONSTANTS from "./lib/websocket_constants.ts";
import {
  checkWS,
  createUpgradeHeaders,
  isOriginAllowed,
} from "./lib/websocket_methods.ts";

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

// https://nodejs.org/docs/latest/api/http.html#event-upgrade_1
http_server.on("upgrade", (req, socket, head) => {
  // req http requestの中身
  // socket アップグレート後、socketオブジェクトが今後のWS通信の全てに使われる。
  // head 通常空
  // console.log(req.headers);

  // https://tex2e.github.io/rfc-translater/html/rfc6455.html#4-1--Client-Requirements
  // 必須ヘッダーチェック
  const upgradeHeaderCheck =
    req.headers.upgrade?.toLocaleLowerCase() === CONSTANTS.UPGRADE;
  const connectionHeaderCheck =
    req.headers.connection?.toLocaleLowerCase() === CONSTANTS.CONNECTION;
  const methodCheck = req.method === CONSTANTS.METHOD;

  // 許可されたオリジンチェック
  const origin = req.headers.origin || "";
  const originCheck = isOriginAllowed(origin);

  if (
    checkWS({
      socket,
      upgradeHeaderCheck,
      connectionHeaderCheck,
      methodCheck,
      originCheck,
    })
  ) {
    upgradeConnection(req, socket, head);
  }
});

function upgradeConnection(
  req: http.IncomingMessage,
  socket: stream.Duplex,
  head: Buffer
) {
  const clientKey = req.headers["sec-websocket-key"] || "";
  // Upgradeヘッダーを受け取ったWS対応サーバーのレスポンス作成
  const headers = createUpgradeHeaders(clientKey);
  socket.write(headers); // もし成功なら、WS接続が成功したということ

  console.log(headers);

  // HTTPハンドシェイクが終わったら、もうTCPソケットしかいらない
  startWebSocketConnection(socket);
}

function startWebSocketConnection(socket: stream.Duplex) {}
