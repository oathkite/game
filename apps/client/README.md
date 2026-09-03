
## デプロイ

client は静的サイトなので Vercel に置く。Root Directory を `apps/client` にし、環境変数 `VITE_SERVER_URL` に server の WebSocket の URL（例 `wss://example.up.railway.app`）を入れる。
`apps/client/vercel.json` にビルドの設定がある。

server は WebSocket を対戦中ずっと保持し、部屋の状態をメモリに持つので、常駐プロセスが動くサービス（Railway、Render、Fly.io）に置く。
`apps/server/Dockerfile` をリポジトリのルートからビルドする。
待ち受けポートは環境変数 `PORT`、生存確認は `/health` で行う。
