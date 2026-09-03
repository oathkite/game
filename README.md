# FORTRESS

ブラウザで遊ぶ 1 対 1 のターン制砲撃対戦ゲーム。設計は [docs/design](./docs/design/README.md) に、開発の進め方は [CLAUDE.md](./CLAUDE.md) にある。

## 構成

| パス | 内容 |
|---|---|
| `packages/sim` | 決定論的な物理、地形、風、ダメージ。golden replay のケースもここに置く |
| `packages/protocol` | メッセージの型と Zod スキーマ、部屋と対戦のデータモデル |
| `packages/maps` | 3 枚のマップ。整数演算で地形マスクを生成する |
| `packages/engine` | 対戦の状態遷移。時刻と乱数を注入する純関数と、時計につなぐ host |
| `apps/server` | Node.js + ws。部屋、ロビー、再接続、engine の橋渡し |
| `apps/client` | Vite + React + PixiJS。solo モードと、オンライン対戦の画面 |
| `apps/e2e` | Playwright。2 つのブラウザで 1 戦を通す。Node とブラウザの golden 比較 |

## 動かす

```sh
pnpm install
pnpm dev          # server（:8787）と client（:5173）を同時に起動する
```

ブラウザで http://localhost:5173/ を開く。
「ひとりで撃つ」はサーバーなしで動く。
オンライン対戦はロビーから部屋を作り、別のブラウザ（または別のプロファイル）でコードを入れて入る。

## テスト

```sh
pnpm test                      # sim、protocol、maps、engine、server、client の単体テスト
pnpm --filter @game/e2e test:e2e   # Playwright（server と client を自動で起動する）
pnpm typecheck
```

サーバーの接続先は `VITE_SERVER_URL`（例 `wss://example.com`）で切り替える。
開発時は Vite が `/ws` を `ws://localhost:8787` へ中継する。

## デプロイ

本番は Cloudflare に置いている。

| 対象 | 場所 | 配置コマンド |
|---|---|---|
| client | Cloudflare Pages: https://fortress-9hj.pages.dev | `cd apps/client && VITE_SERVER_URL=wss://fortress-server.kita-396.workers.dev pnpm build && pnpm exec wrangler pages deploy dist --project-name fortress --branch main` |
| server | Cloudflare Workers + Durable Objects: https://fortress-server.kita-396.workers.dev | `cd apps/server && pnpm exec wrangler deploy` |

配置は `main` へのマージで自動的に行う（`.github/workflows/deploy.yml`）。
typecheck と単体テストを通してから server、次に client の順で配置し、手で `wrangler deploy` を打つのは復旧や検証のときだけにする。
workflow は GitHub の Actions 画面から手動でも起動できる。
リポジトリの secrets に次の 2 つを置く。

| secret | 内容 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Workers Scripts、Durable Objects、Cloudflare Pages の編集権限を持つ API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare のアカウント ID |

server は 1 つの Durable Object が全部屋を持ち、WebSocket Hibernation で接続を受け、制限時間などの起床は alarm で行う。
状態は命令のたびに storage へ保存し、退避から戻ったときに復元する。
費用が増える経路は Durable Object の要求数、実行時間、storage 書き込みで、alarm は 1 秒より短い間隔で鳴らさない。
部屋も接続も無いときは storage を空にし、alarm も持たないので、誰も遊んでいなければ費用はかからない。

Node で動かす場合は `apps/server/Dockerfile` をリポジトリのルートからビルドする。
待ち受けポートは環境変数 `PORT`、生存確認は `/health` で行う。
