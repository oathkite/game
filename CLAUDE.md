# CLAUDE.md

このリポジトリでの開発の進め方を定める。
ユーザー共通の規約（`~/.claude/CLAUDE.md`）に加えて、このプロジェクトに固有の決まりだけを書く。

## 設計書が正

- 仕様は `docs/design` にある。実装と設計書が食い違ったら、どちらが正しいかを決めてから直す。実装を変えたなら同じ PR で設計書も変える。
- 設計書から外れる判断（採用技術、定数、マップの形など）は、外れる理由を該当する章に書き、`99-open-questions.md` の TBD を更新する。報告だけで済ませない。
- 初期値として置いた数値は遊んで調整する前提のものである。変えるときは `packages/maps/test/valley-feel.test.ts` のような「手触りを数値で固定するテスト」を更新し、変えた根拠を設計書に残す。

## パッケージの依存の向き

```
protocol ← sim ← maps ← engine ← server
                                ← client
```

- 矢印の逆方向に import しない。`sim` が `protocol` の型と定数（マップの大きさ）を使うのはよいが、`protocol` が `sim` を使ってはならない。
- `sim` には DOM も Node の API も入れない。`(state, input) => result` の純関数だけを置く。
- `engine` と `server` は時刻と乱数を外から受け取る。`Date.now()` と `Math.random()` を関数の中で呼ばない。時計は `Clock`、乱数は `rng` として注入する。

## 決定論の契約

物理（`packages/sim`）はサーバーとクライアントで同じ結果を出さなければならない。

- 浮動小数点を使わない。位置と速度は固定小数点の整数、三角関数は表。`Math.trunc` と `Math.floor` 以外の丸めを使わない。ビット演算も使わない。
- 物理を変えたら `pnpm --filter @game/sim test -u` で golden snapshot を更新し、差分が意図した変更だけであることを diff で確認してからコミットする。snapshot の更新は物理の変更と同じコミットに入れる。
- クライアントは `turn.result` を再計算してサーバーの値と照合する。不整合は `mismatches` に数える。e2e で `mismatches` が 0 であることを崩さない。

## ブランチとコミット

- `main` には PR 経由でだけ入れる。作業は `feat/<内容>` か `fix/<内容>` で行い、draft PR を早めに開く。
- コミットは Conventional Commits を日本語で書き、1 コミット 1 責務にする。テストと typecheck が通った状態でコミットする。
- push は HTTPS で行う（`git push https://github.com/oathkite/game.git <branch>`）。この環境には SSH 鍵が無く、`gh` の認証を使う。
- Playwright の成果物（`test-results/`、`playwright-report/`）はコミットしない。

## 変更前後のゲート

作業を始める前と、コミットする前に次を通す。

```sh
pnpm -r typecheck
pnpm test                          # 単体テスト
pnpm --filter @game/e2e test:e2e   # server か client の振る舞いを変えたとき
```

- e2e は `battle.spec.ts` だけで 7 分かかる。日常は `match.spec.ts` と `reconnect.spec.ts` を回し、決着まわりを触ったときだけ全件を回す。
- Workers 版のサーバーを変えたら、`wrangler dev --port 8788 --local` を起こし、`VITE_DEV_SERVER_TARGET=ws://localhost:8788` で e2e を回す。
- コミット前に `/code-review` を実行する。指摘は全件判断し、直さないものは理由を PR に書く。

## サーバーを変えるときの注意

- 中身は `handleCommand(state, command, now)` の純関数に置き、`ws.ts`（Node）と `cf/worker.ts`（Workers）は薄いアダプタに留める。両方の typecheck（`tsconfig.json` と `tsconfig.cf.json`）を通す。
- `ServerState` や `EngineState` の形を変えたら `persist.ts` の保存と復元を合わせ、`test/persist.test.ts` を更新する。Durable Object に保存済みの古い状態は復元できなくなるので、形を変える配置の前に本番の部屋が無いことを確かめる。
- 受信メッセージは必ず `parseClientMessage` を通す。スキーマは `packages/protocol/src/schemas.ts` に置き、サーバーで独自に検証しない。
- 制限時間、再接続、リザルトの自動クローズ、放置部屋の削除は偽の時計でテストする。実時間で待つテストを書かない。

## クライアントを変えるときの注意

- 接続とストアは `useEffect` の中で作り、cleanup で閉じる。`useMemo` で作らない（StrictMode の二重マウントで閉じた接続を使ってしまう）。
- 入力は Pointer Events とキーボードだけを使い、長押しの反復は自前のタイマーで行う。`mouse*` と `touch*` のイベントは登録しない。
- 開発用のフック（`window.__fortress`、照準の探索）は `import.meta.env.DEV` の中にだけ置く。本番ビルドに残さない。
- 描画（PixiJS）と判定（`sim`）を混ぜない。見た目を変えるときに `sim` を触らない。
- 関数は 50 行未満に分ける。`replay.ts` の段階ごとの関数や `sessionHandlers.ts` のように、状態を持つオブジェクトと純関数に分ける形を踏襲する。

## デプロイ

本番は Cloudflare にある。手順と URL は `README.md` の「デプロイ」にある。

- `main` へのマージで GitHub Actions（`.github/workflows/deploy.yml`）が本番へ配置する。PR をマージすることが配置の操作なので、マージ前に e2e まで通しておく。
- 配置の順序は server（`wrangler deploy`）、次に client（`VITE_SERVER_URL` を server の URL にしてビルドし `wrangler pages deploy`）。workflow もこの順序で行う。
- 配置後は 2 つのブラウザで部屋の作成、入室、開始、射撃、ターン進行を確かめる。
- 費用の見張り: alarm の下限（1 秒）と「部屋も接続も無ければ storage を空にする」を外さない。Durable Object の要求数と storage 書き込みが増える変更（命令ごとの保存回数、alarm の頻度）は PR に見積もりを書く。
- 認証は `wrangler login` で行い、トークンや `.env` をコミットしない。

## レビューと報告

- PR には、設計書からの逸脱、テストの件数、e2e の実行結果、未実施のことを書く。
- 遊びの手触りに関わる変更（定数、マップ、操作）は、数値の裏付けと実際に撃った所見を分けて書く。面白さの最終判断は人が遊んで行う。
