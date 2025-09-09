import * as stream from "node:stream";
import * as CONSTANTS from "./websocket_constants.ts";
import crypto from "crypto";

export function isOriginAllowed(origin: string) {
  return CONSTANTS.ALLOWED_ORIGINS.includes(origin);
}

type CheckWS = {
  socket: stream.Duplex;
  upgradeHeaderCheck: boolean;
  connectionHeaderCheck: boolean;
  methodCheck: boolean;
  originCheck: boolean;
};

export function checkWS({
  socket,
  upgradeHeaderCheck,
  connectionHeaderCheck,
  methodCheck,
  originCheck,
}: CheckWS) {
  if (
    upgradeHeaderCheck &&
    connectionHeaderCheck &&
    methodCheck &&
    originCheck
  ) {
    return true;
  } else {
    // https://tex2e.github.io/rfc-translater/html/rfc6455.html#4-2--Server-Side-Requirements
    // the server MUST stop processing the client's handshake and return an HTTP response with an appropriate error code (such as 400 Bad Request).
    const message =
      "400 bad request. The HTTP headers do not comply with the RFC 6455 spec.";
    const messageLength = message.length;
    const response =
      `HTTP/1.1 400 Bad Request\r\n` +
      `Content-Type: text/plain\r\n` +
      `COntent-Length: ${messageLength}\r\n` +
      `\r\n` +
      message;

    socket.write(response);
    socket.end(); // TCP接続を切る。サーバー自体は動いている
  }
}

export function createUpgradeHeaders(clientKey: string) {
  // sec-websocket-key の値を利用して、定義された計算方法に従ってSec-WebSocket-Acceptの値を出力
  const serverKey = generateServerKey(clientKey);

  // 5. If the server chooses to accept the incoming connection, it MUST reply with a valid HTTP response indicating the following.
  const headers = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${serverKey}`,
  ];

  const upgradeHeaders = headers.join("\r\n") + "\r\n\r\n";
  return upgradeHeaders;
}

// generating the server accept key
function generateServerKey(clientKey: string) {
  // client keyとGUIDを連結する
  const data = clientKey + CONSTANTS.GUID;
  // hashを取得
  const hash = crypto.createHash("sha1");
  hash.update(data);
  // base64エンコーディングを取得
  const serverKey = hash.digest("base64");
  return serverKey;
}

export function unmaskedPayload(payloadBuffer: Buffer, maskKey: Buffer) {
  // マスクキーを利用してペイロードをアンマスクする
  for (let i = 0; i < payloadBuffer.length; i++) {
    // 1バイトずつループしてmaskKeyとXORする
    // maskKeyは4バイトなので、5バイト以降はmaskKeyの先頭から繰り返し使う
    payloadBuffer[i] = payloadBuffer[i] ^ maskKey[i % CONSTANTS.MASK_LENGTH];
  }
  return payloadBuffer;
}
