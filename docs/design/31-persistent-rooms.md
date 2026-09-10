# 部屋単位の永続化サーバー

`apps/server/src/rooms/core.ts` はWebSocketを持たないRoom reducer。NodeとCloudflareの両アダプターが使用する。
`RoomRuntime` は同じ部屋の入力を直列化し、snapshot保存後にstateを公開する。保存失敗時はACKを返さず以前のstateを保持する。

## Cloudflare

`wrangler.v2.jsonc` はKEROPOD用の別構成。既存本番の`wrangler.jsonc`とHubは変更しない。
各RoomObjectはSQLiteにsnapshotと次alarmを同一transactionで保存する。
RoomDirectoryは公開summaryのみを保持し、token/入力/地形計算を持たない。コードの再利用による過去のRoomObjectへの誤接続を防ぐため割当済みコードを保持する。

- `POST /v2/rooms`: 部屋コードを割り当てる。
- `GET /v2/rooms`: 最大100件の公開summary。
- `GET /v2/rooms/:id`: WebSocket接続。作成者はroom.create、参加者はroom.join、復帰者はroom.resumeを送る。
- OriginはALLOWED_ORIGINSの完全一致。公開ドメインはリリース時に確定して設定する。
- 接続identityはランダムconnectionId。再接続時はsession generationを増加。古い接続のmessage/closeは新しい接続を変更しない。
- alarmは手番期限、再生終了、切断猶予、未認証接続期限、Directory更新の最短期限。
- hibernationではattachmentとSQLiteから復元。プロセス消失で存在しなくなったsocketは照合して切断扱いにし、60秒の復帰猶予を与える。

## ローカル検証

serverディレクトリで実行する。

```sh
pnpm exec wrangler dev --config wrangler.v2.jsonc --port 8796 --local --persist-to .keropod/edge
EDGE_TEST_URL=http://127.0.0.1:8796 pnpm exec vitest run test/edge-rooms.test.ts
pnpm exec tsx scripts/verify-edge-restart.ts
```

再起動試験は未使用の8797を使い、専用の一時SQLiteに保存する。live接続中にプロセスグループをSIGKILLし、同じ保存先で再起動して試合/地形/重複排除を検証する。

clientに`VITE_ROOM_SERVER_URL=http://127.0.0.1:8796`を渡すとedgeへ接続する。HTTPSのURLではwssを使用。
未設定時のNode8795も同じreducerを使用し、`.keropod/rooms`へ保存する。E2Eごとに完全分離するときは`ROOM_STORE_DIR`を指定する。

## 仕様の参照

- [WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [SQLite transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)

観戦と[クイック参加](32-quick-play.md)を追加済み。世界各地の実測、負荷・長時間試験、運用監視、公開用ドメイン設定は後続工程。ローカルランタイムの合格を世界各地での本番検証と同一視しない。

## Nodeの同時部屋検証

Node adapterはcustom/quickとも128部屋を上限とし、各部屋は8参加者＋8観戦者の定員を維持する。
旧custom作成だけの256セッション判定はquick経路と不一致だったため廃止した。
次の試験で100部屋・800接続の作成/編成/同時移動/射撃/100接続の切断復帰/重複拒否/部屋分離を確認できる。

```sh
ROOM_LOAD_COUNT=100 pnpm --filter @game/server exec vitest run test/concurrent-rooms.test.ts
```

通常testでは4部屋で実行する。環境変数は1〜100の整数のみ。
これは同一プロセスのNode transport・メモリ保存の短時間試験であり、DO/Directory/永続I/O/地域RTT/長時間の容量gateを証明しない。

`ROOM_LOAD_PERSIST=1`を付けると、一時ディレクトリで実際の原子的JSONファイル保存を使用する。
全接続を閉じ、切断状態の保存を待ってから全室を読み直し、保存時のBattleSnapshotとの一致を検証する。
一時保存にはセッショントークンを含むため、テスト終了時にディレクトリごと削除し、ログへ内容を出さない。

```sh
ROOM_LOAD_COUNT=100 ROOM_LOAD_PERSIST=1 pnpm --filter @game/server exec vitest run test/concurrent-rooms.test.ts
```

このモードもローカルファイルI/Oの短時間試験であり、SQLite DO実環境の保存性能や長時間安定性とは区別する。

`ROOM_LOAD_DELAY_MS=125`を指定すると、クライアントの送信と受信通知をそれぞれ125ms遅らせる。
WebSocket自体のパケット損失・帯域制限・ブラウザー描画は再現しない。ping応答に往復分の遅延が入ることを確認してから移動/射撃/復帰を検証する。
値は0〜500msの整数（片道）。

```sh
ROOM_LOAD_COUNT=100 ROOM_LOAD_PERSIST=1 ROOM_LOAD_DELAY_MS=125 pnpm --filter @game/server exec vitest run test/concurrent-rooms.test.ts
```
