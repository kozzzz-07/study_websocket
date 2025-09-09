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
- Node.js Doc
  - https://nodejs.org/api/process.html


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


## 自己証明書生成＆ローカルHTTPS設定
- `npx mkcert create-ca`
- `npx mkcert create-cert`
- クライアント側
  - `client`配下の`oreore_cert`に自己照明を配置
  - `.vscode`の`liveServer.settings.https`のパスを修正する
  - liveServerを起動する
- サーバー側
  - `vanilla`配下の`oreore_cert`に自己照明を配置
  - `node --import=tsx index_v3.ts`

## 素WSの確認
- `vanilla/index_v3.ts`
  - https化の対応必要
    - 「自己証明書生成＆ローカルHTTPS設定」参考
    - index_v3.ts以外を動かす時はHTTPS対応いらない
    - ブラウザから接続できない時は一回 `https://127.0.0.1:4430/` にアクセスする