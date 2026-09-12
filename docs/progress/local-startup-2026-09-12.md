# 標準のローカル起動を新UIに接続

旧 `pnpm dev` はNode8787を起動していたが、新UIの未指定接続先は8795で、READMEどおりの起動ではオンライン対戦ができなかった。
標準コマンドをVite5173 + ローカルWrangler8796へ変更し、Room APIのHTTP originを明示した。旧コマンドは `dev:legacy` に保存。
実クラウドの配置・bindingsへの接続は行っていない。Wranglerの全bindingsがlocalと表示されることを確認。

## 検証

- `pnpm dev`: 両サービスが起動。Ctrl+Cで終了後に5173・8796の待受が残らないことを確認。
- `pnpm --filter @game/e2e exec playwright test --config dev.config.ts`: Chromium 1件成功（16.4秒）。標準コマンドの自動起動から2つの独立contextで部屋作成、参加、開始、射撃、地形破壊の一致、再接続後の地形・カメラ復元を検証。
- `pnpm --filter @game/e2e typecheck` と `git diff --check`: 成功。
- ユーザーが開いている5186のサーバーは維持。

この手順は同じPCのブラウザ向け。実機/LAN、公開URL、実地域・費用の検証を代替しない。
Wranglerの起動条件は[公式ローカル開発資料](https://developers.cloudflare.com/workers/local-development/)と導入済み4.129.0のhelpで確認。
