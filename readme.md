## memo
- WebSocket APIはとてもシンプルな設計
  - WebSocketでリッスンできる4つのイベント
    - open
    - message
    - error
    - close
  - 利用できる2つのメソッド
    - send
    - close
- WebSocketプロトコル
  - どのようにクライアントとサーバーが通信すべきか
  - https://datatracker.ietf.org/doc/html/rfc6455
    - https://tex2e.github.io/rfc-translater/html/rfc6455.html
  - https://datatracker.ietf.org/doc/html/rfc8441
    - https://tex2e.github.io/rfc-translater/html/rfc8441.html
  - https://datatracker.ietf.org/doc/html/rfc9220
    - https://tex2e.github.io/rfc-translater/html/rfc9220.html
- WebSocket API
  - プロトコルを実装上どう扱うかを標準化した資料
  - https://triple-underscore.github.io/WebSocket-ja.html


## test
### 1
- `cd node_server`
- `node index.js`
- `cd client`
- index.htmlを適当にローカルで動かす

### 2
- `cd node_server/frames`
- `node app.js`
- `cd client/frames`
- index.htmlを適当にローカルで動かす


## 自己証明書生成
- `npx mkcert create-ca`
- `npx mkcert create-cert`
- クライアント側は `.vscode`の`liveServer.settings.https`のパスを修正する