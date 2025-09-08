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

const serverKey = fs.readFileSync("./vanilla/oreore_cert/cert.key");
const serverCert = fs.readFileSync("./vanilla/oreore_cert/cert.crt");

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
  socket.on("data", (chunk: Buffer) => {
    // dataで受け取るデータは常にバッファが流れてくる
    console.log("chunk received");
    receiver.processBuffer(chunk);
  });

  socket.on("end", () => {
    console.log("there will be bo more data. The WS connection is closed.");
  });
}

class WebSocketReceiver {
  private _socket: stream.Duplex;
  private _buffersArray: Buffer[] = []; // 受信したデータのチャンクを格納する配列
  private _bufferedBytesLength = 0; // 受信した各チャンク後のカスタムバッファ内の総バイト数を追跡する
  private _taskLoop = false;
  private _task = GET_INFO;
  private _fin = false; // メッセージの最後のフラグメントが受信したかどうか
  private _opcode: number | undefined = undefined; // 受信データの種類
  private _masked = false; // 受信フレームがマスクされているかどうか
  private _initialPayloadSizeIndicator = 0; // 処理中のペイロードのサイズインジケーター
  private _framePayloadLength = 0; // 受信した1つのWebsocketフレームの長さ
  private _maxPayload = 1024 * 1024; // クライアントが送信できるデータ量の上限。 1 megabyte (MiB) のサイズ
  private _totalPayloadLength = 0;
  private _mask: Buffer = Buffer.alloc(CONSTANTS.MASK_LENGTH); // クライアントによって設定され送信されたマスキングキーを保持する
  private _framesReceived = 0; // Websocketメッセージに関連して受信されたフレームの総数

  constructor(socket: stream.Duplex) {
    this._socket = socket;
  }

  processBuffer(chunk: Buffer) {
    this._buffersArray.push(chunk);
    this._bufferedBytesLength += chunk.length;
    this._startTaskLoop();
  }

  _startTaskLoop() {
    // 1. 受信したWSフレームから情報を取得する
    // 2. WSフレームの正確なペイロードサイズを計算する
    // 3. ペイロードのマスクをアンマスクする （ペイロード全体が受信できるまではしない)

    this._taskLoop = true;

    do {
      switch (this._task) {
        case GET_INFO:
          this._getInfo();
          break;
        case GET_LENGTH:
          this._getLength();
          break;
        case GET_MASK_KEY:
          this._getMaskKey();
          break;
        case GET_PAYLOAD:
          this._getPayload();
          break;
      }
    } while (this._taskLoop);
  }

  private _getInfo() {
    // 必須ヘッダーの最初の２バイトへの処理
    /**
      0                   1                   2                   3
      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
     +-+-+-+-+-------+-+-------------+-------------------------------+
     |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
     |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
     |N|V|V|V|       |S|             |   (if payload len==126/127)   |
     | |1|2|3|       |K|             |                               |
     +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
    */

    const infoBuffer = this._consumeHeaders(CONSTANTS.MIN_FRAME_SIZE);
    const firstByte = infoBuffer[0];
    const secondByte = infoBuffer[1];

    // 抽出
    this._fin = (firstByte & 0b10000000) === 0b10000000; // FIX bit (0x80 hex)
    this._opcode = firstByte & 0b00001111; // Opcode (0x0F hex)
    this._masked = (secondByte & 0b10000000) === 0b10000000; // Masked bit (0x80 hex)
    this._initialPayloadSizeIndicator = secondByte & 0b01111111; // Payload length (0x7F hex)

    // クライアントから送信されるデータは必ずマスクされている必要がある
    if (!this._masked) {
      // TODO: エラーではなく、クローズフレームを返すようにする
      throw new Error("Mask is not set by the client.");
    }

    this._task = GET_LENGTH;
  }

  private _consumeHeaders(n: number) {
    // バッファのバイト長を、消費するバイト数分だけ減らす
    this._bufferedBytesLength -= n;

    // 抽出したサイズが実際のバッファと同じ場合は、バッファ全体を返す
    if (n === this._buffersArray[0].length) {
      // undefinedを返す可能性がないためasを使用
      return this._buffersArray.shift() as Buffer;
    }

    // 抽出したサイズがバッファ内のデータサイズより小さい場合
    if (n < this._buffersArray[0].length) {
      // 一時的なバッファを作成
      const infoBuffer = this._buffersArray[0];
      // 消費したバッファを削除
      this._buffersArray[0] = this._buffersArray[0].subarray(n);
      // 一時的なバッファを削除（nには2しか入らない想定）
      return infoBuffer.subarray(0, n);
    } else {
      throw new Error(
        "You can not extract more data from a ws frame than the actual frame size."
      );
    }
  }

  private _getLength() {
    // WSメッセージ（フラグメント）の実際のペイロード長を抽出する処理。ペイロードサイズは、大中小の３段階ある。
    // https://tex2e.github.io/rfc-translater/html/rfc6455.html#4-1--Client-Requirements:~:text=Payload%20length%3A%20%207%20bits%2C%207%2B16%20bits%2C%20or%207%2B64%20bits
    // small: Payload lenが0-125の時はそのままのサイズがペイロードサイズ。7ビットの「Payload len」をそのまま使える
    /**
        1           
      9 0 1 2 3 4 5 
      +-------------+
      | Payload len |
      |     (7)     |
      |             |
      |             |
      +-------------+
    */
    // medium: Payload lenが126の時は、126-65535バイトまで。次の2バイト「Extended payload length」まで読み込む必要がある。
    /**
      1                   2                   3
    9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
    +-------------+-------------------------------+
    | Payload len |    Extended payload length    |
    |     (7)     |             (16/64)           |
    |             |   (if payload len==126/127)   |
    |             |                               |
    +-------------+ - - - - - - - - - - - - - - - +
    */
    // large: Payload lenが127の時。65535バイトより大きいサイズ。その後の8バイトまで読み込む必要がある。
    /**
      0                   1                   2                   3
      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
     +-+-+-+-+-------+-+-------------+-------------------------------+
     |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
     |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
     |N|V|V|V|       |S|             |   (if payload len==126/127)   |
     | |1|2|3|       |K|             |                               |
     +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
     |     Extended payload length continued, if payload len == 127  |
     + - - - - - - - - - - - - - - - +-------------------------------+
     |                               |
     +-------------------------------+
    */

    switch (this._initialPayloadSizeIndicator) {
      case CONSTANTS.MEDIUM_DATA_FLAG:
        const mediumPayloadLengthBuffer = this._consumeHeaders(
          CONSTANTS.MEDIUM_SIZE_CONSUMPTIONS
        );
        this._framePayloadLength = mediumPayloadLengthBuffer?.readUint16BE();
        this._processLength();
        break;

      case CONSTANTS.LARGE_DATA_FLAG:
        const largePayloadLengthBuffer = this._consumeHeaders(
          CONSTANTS.LARGE_SIZE_CONSUMPTIONS
        );
        // 8バイトのペイロードは、JSのnumberでは安全に扱える範囲を超えるためBigintで取得する。
        const bufBigInt = largePayloadLengthBuffer.readBigUInt64BE();
        this._framePayloadLength = Number(bufBigInt);
        this._processLength();
        break;
      default:
        // 125バイト以下の場合は、そのままペイロード長になる
        this._framePayloadLength = this._initialPayloadSizeIndicator;
        this._processLength();
        break;
    }
  }

  _processLength() {
    this._totalPayloadLength += this._framePayloadLength;
    // クライアントがWSサーバーを悪用しようとした場合
    if (this._totalPayloadLength > this._maxPayload) {
      // TODO: エラーではなく、クローズフレームを返すようにする
      throw new Error("Data is too large");
    }

    this._task = GET_MASK_KEY;
  }

  _getMaskKey() {
    /**
      0                   1                   2                   3
      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
     + - - - - - - - - - - - - - - - +-------------------------------+
     |                               |Masking-key, if MASK set to 1  |
     +-------------------------------+-------------------------------+
     | Masking-key (continued)       |        
     +-------------------------------- 
    */
    this._mask = this._consumeHeaders(CONSTANTS.MASK_LENGTH);
    this._task = GET_PAYLOAD;
  }

  _getPayload() {
    /**
      0                   1                   2                   3
      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
     +-------------------------------+-------------------------------+
     |                               |          Payload Data         |
     +-------------------------------- - - - - - - - - - - - - - - - +
     :                     Payload Data continued ...                :
     + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
     |                     Payload Data continued ...                |
     +---------------------------------------------------------------+
    */

    // フルフレームペイロード用ループ
    // まだペイロード全体を受信していない場合は、ソケットオブジェクト上で新しい"data"イベントが発生するのを待ち、さらにデータを受信する
    if (this._bufferedBytesLength < this._framePayloadLength) {
      this._taskLoop = false;
      return;
    }

    // フルフレーム受信（フラグメント化されたメッセージがある場合はさらにフレームがある場合がある）
    this._framesReceived++;

    // WSフレームペイロード全体を消費する
    const fullMaskedPayloadBuffer = this._consumePayload(
      this._framePayloadLength
    );
  }

  _consumePayload(n: number) {
    // バッファのバイト長を、消費するバイト数分だけ減らす
    this._bufferedBytesLength -= n;

    // データを格納するための新しいバッファを作成
    const payloadBuffer = Buffer.alloc(n);
    // payloadBufferに読み込まれたバイト数を追跡
    let totalBytesRead = 0;

    // このループは、全ての"n"バイトがpayloadBufferに読み込まれるまでデータを読み込みづづける
    while (totalBytesRead < 0) {
      const buf = this._buffersArray[0]; // チャンク配列から最初のデータを取得
      const bytesToRead = Math.min(n - totalBytesRead, buf.length); // 必要なバイト数を計算（残りの必要バイト数と現在のチャンクの長さを比較。小さい方を選ぶことで、バッファサイズを超えて読むことを回避）
      buf.copy(payloadBuffer, totalBytesRead, 0, bytesToRead); // payloadBufferにバイトを読み込む

      // _buffersArrayを更新する。（最初の要素を部分的に更新するか完全に削除）
      if (bytesToRead < this._buffersArray[0].length) {
        this._buffersArray[0] = buf.subarray(bytesToRead); // 最初の要素の一部を削除
      } else {
        this._buffersArray.shift(); // 最初の要素を削除
      }

      totalBytesRead += bytesToRead; // 読み込んだバイト数を更新
    }

    return payloadBuffer;
  }
}
