# KEROPOD

自分のキャラクターが共通キャノピーのマシンに乗り、風と地形を読んで一発を競う、2D ドット絵の砲撃対戦ゲームを目指す。
現在は 1 対 1 の対戦機能を実装済みで、新しいアートと UI は制作段階。設計は [docs/design](./docs/design/README.md) に、開発の進め方は [CLAUDE.md](./CLAUDE.md) にある。

## アートと UI の制作

[世界観](./docs/design/00-world-and-experience.md)、[UI の方向性](./docs/design/08-visual-direction.md)、[素材一覧](./docs/design/13-asset-preview.md)、[制作規約と検証](./docs/design/14-asset-pipeline.md) を基準にする。
機体は真横で本体形状を固定し、搭乗者、足回り、武器を独立させる。
生成プレビューは完成 atlas と区別する。

```sh
pnpm assets:test
pnpm assets:check
pnpm assets:lab          # http://127.0.0.1:4178 で動作試験台を開く
pnpm assets:test:browser # 試験台の操作と描画を検証
```

## プロモーション動画

その一発が、地形を変える。実際の対戦映像で紹介する 30 秒の動画（音声あり）。新アート導入前の実装映像。

https://github.com/user-attachments/assets/95a2c021-a18d-4035-a9db-abe4163ebb62

[ブラウザで遊ぶ](https://fortress-9hj.pages.dev)

## 構成

| パス | 内容 |
|---|---|
| `packages/sim` | 決定論的な物理、地形、風、ダメージ。golden replay のケースもここに置く |
| `packages/protocol` | メッセージの型と Zod スキーマ、部屋と対戦のデータモデル |
| `packages/maps` | 8 枚のマップ。整数演算で地形マスクを生成する |
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
「プラクティス」はサーバーなしで動く。
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

ローカルの [動作試験台](./tools/asset-lab/README.md) は新デザインの [baseline-v2](./assets/workbench/baseline-v2/README.md) を表示する。`pnpm assets:lab` で起動し、`pnpm assets:test:browser` と `pnpm assets:capture` で再確認できる。ゲーム本体へのスプライト統合は未実施。

## 2Dアップデートの開発

総合ブランチは `codex/2d-update`。今後の2D関連の実装・アセット・仕様変更は、このブランチから作業ブランチを切って進める。[ブランチ運用](docs/2d-update-workflow.md)を参照。
