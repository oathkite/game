# TANK SHOOT

自分のマシンで風と地形を読み、一発を競う、2D ドット絵の砲撃対戦ゲームを目指す。
2Dアップデートの作業ブランチでは最大8人・任意のチーム分割、リアルタイム移動、画像地形の破壊、再接続、練習、BGM・効果音を実装済み。最終的な見た目と実機・公開環境の検証は継続中。設計は [docs/design](./docs/design/README.md) に、開発の進め方は [CLAUDE.md](./CLAUDE.md) にある。

## アートと UI の制作

[世界観](./docs/design/00-world-and-experience.md)と[UI の方向性](./docs/design/08-visual-direction.md)を基準にする。
機体は真横で本体形状を固定し、足回りと武器を独立させる。
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
| `packages/maps` | 画像地形の3マップと旧8マップ。描画・衝突判定の地形を共有する |
| `packages/engine` | 対戦の状態遷移。時刻と乱数を注入する純関数と、時計につなぐ host |
| `apps/server` | Workers + Durable Objects の部屋APIと対戦。旧Node.jsサーバーも保持 |
| `apps/client` | Vite + React + PixiJS。タイトル、ロビー、練習、オンライン対戦、設定、リザルト |
| `apps/e2e` | Playwright。2 つのブラウザで 1 戦を通す。Node とブラウザの golden 比較 |

## 動かす

```sh
pnpm install
pnpm dev          # 新Room API（:8796）と client（:5173）をローカル起動
```

ブラウザで http://127.0.0.1:5173/ を開く。
Wranglerのローカル実行を使い、クラウドへのデプロイは行わない。保存先は `apps/server/.keropod/dev-rooms`。
この標準コマンドは同じPCのブラウザ向け。ポートが使用中なら既存プロセスの用途を確認する。
「プラクティス」はサーバーなしでも動く。CPU戦のJev判断を有効にする場合は[APIキーとデプロイの設定手順](docs/jev-cpu-setup.md)を参照。出撃準備から、全8面の「ターゲットチャレンジ」、両方の機体を操作する「自由練習」、相手が自動で行動する「CPU戦」に進む。自由練習とCPU戦ではマップと装備を選べる。CPU戦は「やさしい・ふつう・むずかしい」の3レベルから選択できる。チャレンジは規定弾数で的をすべて壊すと次の面が解放され、最少弾数をブラウザに保存する。ルールと画面遷移は[設計書37](docs/design/37-practice.md)を参照。
オンライン対戦はロビーから部屋を作り、別のブラウザ（または別のプロファイル）でコードを入れて入る。

## テスト

```sh
pnpm test                      # sim、protocol、maps、engine、server、client の単体テスト
pnpm --filter @game/e2e exec playwright test --config dev.config.ts # 標準起動で2人の射撃・再接続
pnpm --filter @game/e2e exec playwright test --config production.config.ts # production build、3ブラウザ
pnpm --filter @game/e2e test:e2e   # 旧対戦の回帰テスト
pnpm typecheck
```

新UIの接続先は `VITE_ROOM_SERVER_URL`（HTTPのRoom API URL）。`pnpm dev` は `http://127.0.0.1:8796` を指定する。
`dev.config.ts` は5173・8796を自動起動するので、検証前に自分の `pnpm dev` を終了する。

旧実装の開発は `pnpm dev:legacy`（Node :8787 / client :5173）で起動し、`/?prototype=legacy` を開く。
旧接続先の設定は `VITE_SERVER_URL` と `/ws` proxy。新Room APIとは別のもの。

## 公開までの確認

2Dアップデートは作業ブランチで検証中。冒頭の公開リンクと紹介動画は旧実装のもので、新実装の公開完了を意味しない。
`main` へのpushは本番デプロイを起動するため、公開は明示的なリリース指示後に行う。
新サーバーの設定は `apps/server/wrangler.v2.jsonc`。旧 `deploy:cf` と区別する。
[最終監査](docs/progress/final-audit-2026-09-10.md)と[判断が必要な項目](docs/progress/owner-decisions-2026-09-12.md)で残る検証・公開条件を確認する。

ローカルの [動作試験台](./tools/asset-lab/README.md) では機体素材を検証できる。ゲーム本体にも2Dスプライトを統合済み。

## 2Dアップデートの開発

総合ブランチは `codex/2d-update`。今後の2D関連の実装・アセット・仕様変更は、このブランチから作業ブランチを切って進める。[ブランチ運用](docs/2d-update-workflow.md)を参照。
