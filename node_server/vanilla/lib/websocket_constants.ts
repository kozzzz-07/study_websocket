// export const PORT = 8080; // v2の動作時
export const PORT = process.env.PORT || 4430;

// https://nodejs.org/api/process.html
export const CUSTOM_ERRORS = [
  "uncaughtException",
  "unhandledRejection",
  "SIGINT", // ターミナルで "Ctrl + C" によるイベントをトリガーした場合に発生
] as const;

// upgrade checks
// https://tex2e.github.io/rfc-translater/html/rfc6455.html#4-1--Client-Requirements
export const METHOD = "GET";
export const VERSION = 13;
export const CONNECTION = "upgrade";
export const UPGRADE = "websocket";
export const ALLOWED_ORIGINS = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "https://localhost:5500",
  "https://127.0.0.1:5500",
  "null", // ブラウザで直接htmlファイルを表示した場合
];
export const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

// WebSocket ルール
export const MIN_FRAME_SIZE = 2; // 2バイト
export const MASK_LENGTH = 4;

// WebSocket Payload関連
export const MEDIUM_DATA_FLAG = 126; // WSフレーム内のペイロードヘッダー。バイナリが11111110、または10進数で126の場合、次の2バイトが実際のペイロード長を表す
export const LARGE_DATA_FLAG = 127; //  WSフレーム内のペイロードヘッダー。バイナリが11111111、または10進数で127の場合、次の8バイトが実際のペイロード長を表す
export const MEDIUM_SIZE_CONSUMPTIONS = 2;
export const LARGE_SIZE_CONSUMPTIONS = 8;

// WebSocket Opcode
export const OPCODE_TEXT = 0x01; // text frame
export const OPCODE_BINARY = 0x02; // binary frame
export const OPCODE_CLOSE = 0x08; // closure frame
export const OPCODE_PING = 0x09;
export const OPCODE_PONG = 0x0a;
