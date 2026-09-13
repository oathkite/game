# 復元不能な部屋の隔離

restoreRoom/restoreBattleが保存snapshotを復元できない場合、Roomにroom_failureを作成し、時刻・restore-failed・outcome=invalidを保存する。元のroom_stateは上書きしない。次の読込でも隔離を維持する。診断の例外本文やsnapshot（session tokenを含みうる）はクライアントやログへ出さない。架空の勝者・スコアを作らない。

接続済みWSへroom-unrecoverableを通知して閉じ、後からの接続にも専用メッセージを返す。対戦deadlineの代わりに一覧削除用outboxの再試行だけをscheduleする。直近の一覧要約がある場合、参加者/観戦者0の更新を送る。旧Directory互換要約のTTL挙動は分割資料の制限が残る。

クライアントは通常切断と区別して理由を表示し、resume token/roomIdを消去する。通常のエラー・切断通知で上書きせず、ロビーへ戻る既存操作を使える。元データを修復しても隔離記録を自動解除しない。

## 検証

- unitで正常snapshotの復元、JSON不正/null/未対応versionの安全なエラー化を確認。
- `pnpm --filter @game/server exec tsx scripts/verify-room-quarantine.ts`（既定8804）。local Wranglerに部屋を作成→SIGKILL→SQLite snapshotをversion999へ変更→同保存先で再起動→専用エラー・welcome無し・一覧から除外→元snapshotの文字列一致・invalid記録を確認。
- 検証専用8794が使用中だった最初の試行は安全に停止し、8804へ切替。他のserverには干渉しない。注入データと検証serverは終了時に削除。
- 配信buildの3browserで専用WSエラーを注入し、理由・resume情報消去・再接続ボタン無し・ロビー帰還を確認（3件、11.9秒）。
- Node/Cloudflare server・client/e2e型チェック、翻訳coverage、既存outbox障害→SIGKILL→alarm復元も成功。

この変更は復元処理が拒否するデータを隔離する。あらゆるstorage故障や意味上の破損を完全に検出するschema監査ではない。実Cloudflare障害や運営の修復手順リハーサルは未検証。
