# CPU戦のJev設定

Jevは位置取り・武器・弾道・行動ペースを選ぶ。移動の安全判定、射撃の誤差、演出はゲーム側で処理する。キーや接続先が未設定でも、既存のローカルCPUで遊べる。

## ローカル

以下はリポジトリのルートで実行する。既存ファイルがある場合はコピーせず必要な項目を追記する。

```sh
cp apps/server/.dev.vars.example apps/server/.dev.vars
cp apps/client/.env.local.example apps/client/.env.local
```

`apps/server/.dev.vars` に取得したキーを設定する（Git管理対象外）。

```dotenv
TYPESAFE_API_KEY=取得したAPIキー
```

`apps/client/.env.local` は公開可能な接続先URLだけを設定する。

```dotenv
VITE_CPU_SERVER_URL=http://127.0.0.1:8789
```

CPU用Workerを別ターミナルで起動する。設定を変更したら再起動する。

```sh
pnpm --filter @game/server exec wrangler dev --config wrangler.cpu.jsonc --port 8789 --local --var 'ALLOWED_ORIGINS:http://127.0.0.1:5190,http://127.0.0.1:5173,http://localhost:5173'
```

ゲームは通常どおり `pnpm dev` で起動する。既存の5190番プレビューを利用する場合は、環境変数がビルド時に取り込まれるため `pnpm --filter @game/client build` を実行してブラウザを再読み込みする。Viteの開発サーバーを利用中なら再起動する。

## 本番

非公開キーはCloudflareの **fortress-cpu Worker** のSecretに設定する。Pagesの環境変数や `VITE_` 変数、設定JSON、GitHubリポジトリにキーを書かない。`.dev.vars` は本番へ自動転送されない。

1. リリース承認後にPRをmainへマージすると、既存のGitHub ActionsがCPU用Workerも配置する。初回はキーなしのためローカルCPUにフォールバックする。
2. `wrangler login` で対象アカウントにログインし、リポジトリのルートで次を実行する。対話入力でキーを渡す。

```sh
pnpm --filter @game/server exec wrangler secret put TYPESAFE_API_KEY --config wrangler.cpu.jsonc
```

この操作はWorkerの新しいバージョンを即時配置する。以降の通常の配置でも登録したSecretは維持される。Cloudflare DashboardのWorkers & Pages → fortress-cpu → Settings → Variables and SecretsからSecretとして設定してもよい。

既存のGitHub Secrets `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を使用するため、TypesafeのキーをGitHub Actionsに追加する必要はない。APIトークンにはCPU用Workerを配置する権限も必要。

`apps/server/wrangler.cpu.jsonc` にモデル名 `jev-latest`、許可Origin、本番での有効化 `JEV_ENABLED`、レート制限を定義している。停止する場合は `JEV_ENABLED` を文字列 `"false"` に変更して配置する。

`.github/workflows/deploy.yml` はCPU Workerをclientより先に配置し、`CPU_SERVER_URL` をビルド時の `VITE_CPU_SERVER_URL` に渡す。現在のURL設定は `https://fortress-cpu.kita-396.workers.dev`。初回配置時にWranglerの出力と一致することを確認し、異なる場合はworkflowのURLを修正する。プレビューや独自ドメインを使う場合は、許可Originにも正確なOriginを追加する。

## 確認方法と費用の境界

プラクティス → CPU戦で敵の手番を待ち、ブラウザのNetworkで `/decision` のPOSTを確認する。200で4項目の選択が返ればJev判断が有効。503は未設定・無効化、429は制限超過、502はJev側の失敗・時間切れ・不正応答、403はOrigin不一致を示す。フォールバックでもCPUは動くので、動いているだけではJev疎通の確認にならない。

CPU手番ごとに1リクエスト、4個のChoiceを送る。上流は2500ms、ブラウザは3000msで打ち切り、再試行はしない。名前や任意の文章は送信しない。追加のDurable Object/storage書き込みはない。IPごと12回/分と全体キー120回/分の制限はCloudflare拠点単位で、厳密な全世界の費用上限ではない。実費はTypesafe側の利用状況も確認する。

自動テストはAPIの代替応答を使用する。`pnpm --filter @game/e2e exec playwright test --config jev.config.ts` で判断取得・射撃・通信失敗時の継続を確認できる。実際のJevの自然さ・選択傾向はキー設定後に複数回プレイして確認する。

参考: [Jev API](https://docs.typesafe.ai/introduction/quickstart)、[Choice](https://docs.typesafe.ai/primitives/choice)、[Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[Rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
