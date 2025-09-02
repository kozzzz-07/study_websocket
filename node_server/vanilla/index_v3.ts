// https対応
import https from "node:https";
import type { IncomingMessage } from "node:http";
import type stream from "node:stream";
import fs from "node:fs";
import type net from "node:net";

import * as CONSTANTS from "./lib/websocket_constants.ts";
import {
  checkWS,
  createUpgradeHeaders,
  isOriginAllowed,
} from "./lib/websocket_methods.ts";

const serverKey = fs.readFileSync("./oreore_cert/cert.key");
const serverCert = fs.readFileSync("./oreore_cert/cert.crt");

// 受信したデータ（チャンク）に対しての、解析ステップ管理用フラグ
// https://datatracker.ietf.org/doc/html/rfc6455#section-5.2
// ヘッダー
const GET_INFO = 1; // 最初の2バイト
const GET_LENGTH = 2; //  Payload len ~ Extended payload length continued, if payload len まで
const GET_MASK_KEY = 3; // Masking-key
// ペイロード
const GET_PAYLOAD = 4; // Payload Data 以降
// プログラム固有のフラグ
const SEND_ECHO = 5;

const https_server = https.createServer(
  { key: serverKey, cert: serverCert },
  (req, res) => {
    // ws:// へのリクエストの場合、以下のコードは実行されない
    // 代わりに、そのリクエストは upgrade イベントリスナーに渡される
    // もし 'upgrade' イベントリスナーが存在しない場合は、エラーがスローされる
    res.writeHead(200);
    res.end(
      'Hello, I hope you enjoy the "under-the-hood" WebSocket implementation'
    );
  }
);

https_server.listen(CONSTANTS.PORT, () => {
  console.log(`The https server is listening on port. ${CONSTANTS.PORT}`);
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
https_server.on("upgrade", (req, socket, head) => {
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
  req: IncomingMessage,
  socket: stream.Duplex,
  head: Buffer
) {
  const clientKey = req.headers["sec-websocket-key"] || "";
  // Upgradeヘッダーを受け取ったWS対応サーバーのレスポンス作成
  const headers = createUpgradeHeaders(clientKey);
  socket.write(headers); // もし成功なら、WS接続が成功したということ
  // console.log(headers);

  // HTTPハンドシェイクが終わったら、もうTCPソケットしかいらない
  startWebSocketConnection(socket);
}

// *** WEBSOCKET SERVER LOGIC
function startWebSocketConnection(socket: stream.Duplex) {
  // データを送るためには、データフレームとして構造化する必要がある。例えばここで以下のコードはNG.
  // socket.write("hello"); // これはダメ

  // socketはstream.Duplex型だが、net.Socketが渡される。net.Socketはstream.Duplexのサブクラス。
  // https://nodejs.org/api/http.html#event-upgrade
  // > This event is guaranteed to be passed an instance of the <net.Socket> class, a subclass of <stream.Duplex>, unless the user specifies a socket type other than <net.Socket>.

  // WS接続があることをターミナルに通知する
  // ポートはTCP接続のたびに、クライアントCPUによってランダムに生成される
  console.log(
    `WS CONNECTION ESTABLISHED WITH CLIENT PORT: ${
      (socket as net.Socket).remotePort // ダウンキャスト
    }`
  );

  // receiverは全ての受信データを処理する。インスタンスは1つだけ。
  const receiver = new WebSocketReceiver(socket);

  // https://nodejs.org/api/net.html#event-data
  // > The data will be lost if there is no listener when a Socket emits a 'data' event.
  // サーバー側でリッスンしてなければ破棄される。
  socket.on("data", (chunk) => {
    console.log("chunk received");
    // receiver.processBuffer(chunk);
  });

  socket.on("end", () => {
    console.log("there will be bo more data. The WS connection is closed.");
  });
}
