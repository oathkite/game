# FORTRESS

ブラウザで遊ぶ 1 対 1 のターン制砲撃対戦ゲーム。設計は [docs/design](./docs/design/README.md) にある。

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
pnpm --filter @game/e2e test   # Playwright（server と client を自動で起動する）
pnpm typecheck
```

サーバーの接続先は `VITE_SERVER_URL`（例 `wss://example.com`）で切り替える。
開発時は Vite が `/ws` を `ws://localhost:8787` へ中継する。
