# FORTRESS client

React、Vite、PixiJS で設定、ロビー、部屋、対戦、リザルトを描く。
起動、サーバー接続、テスト、本番の Cloudflare 配信は [ルート README](../../README.md) を参照する。

新しい世界観と画面は [設計目次](../../docs/design/README.md) を基準にする。
キャラクターが見える固定キャノピーの真横スプライトと、ガレージを中心にした UI は制作目標であり、実装済みとは扱わない。
PNG と素材定義を追加する前に [制作規約](../../docs/design/14-asset-pipeline.md) の検証を通す。
物理セルと原画の art px を分け、絵の変更で sim の判定や再生時刻を変更しない。
