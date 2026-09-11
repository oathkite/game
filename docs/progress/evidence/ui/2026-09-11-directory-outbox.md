# Directory要約の永続outbox

Roomの状態保存transaction内で、最新の一覧用要約もSQLiteへ保存する。送信はcommit後に行い、Directoryの応答を対戦コマンドの完了条件にしない。変更がない要約は4分ごとのTTL更新だけを送る。

未送信要約は1行にまとめる。人数やphaseの新しい変更で置換し、古い送信の完了は一致する要約だけをacknowledgeする。時刻は保存済み値から単調増加させる。外部RPCの前に5秒後の再試行alarmを永続化するため、失敗時も未送信状態が残る。試合・切断・handshakeの既存deadlineと最短時刻を共有する。

## 検証

- 実SQLiteのunitで送信失敗、クラス再構築、期限前の再送抑止、送信中の新しい人数変更、空室更新、古いackによる新要約の消失防止、heartbeatを確認。
- serverのNode/Cloudflare両方の型チェック成功。
- local Wranglerでedge専用3件（同時quick割当・開始、公開一覧21部屋、再接続など）成功。

## local edgeの障害・再起動検証

`pnpm --filter @game/server exec tsx scripts/verify-directory-outbox.ts` を実行し成功。

1. 検証専用の一時WorkerでDirectory.updateだけに例外を注入。部屋作成と参加は成功し、更新失敗のログと公開一覧への未掲載を確認。
2. 自分で起動したWranglerのprocess groupをSIGKILLし、同じSQLite保存先で障害注入を無効にして再起動。
3. 部屋へWS/HTTP要求を送らず、公開一覧だけをpoll。保存済みalarmから参加者1名の部屋が反映されることを確認。
4. 以前のtokenで同じ部屋へ復帰し、generation 2を確認。

一時Worker・config・SQLite保存先は実行後に削除。障害注入分岐はproductionコードへ追加していない。既存port使用時は停止して他のserverを壊さない。portはEDGE_OUTBOX_PORTで指定可能（既定8796）。

これはlocal workerdの障害注入・SIGKILL復元の証拠であり、実Cloudflare上の障害・容量・費用を証明しない。Directoryの地域・mode・shard分割も残る。
