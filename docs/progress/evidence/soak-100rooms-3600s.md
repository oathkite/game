# 100部屋・800接続・1時間試験

2026-09-10。Nodeローカルgateway、実ファイル保存、送受信それぞれ125msのアプリケーション遅延。client/server/test runnerは同一process。

```
ROOM_LOAD_COUNT=100 ROOM_LOAD_PERSIST=1 ROOM_LOAD_DELAY_MS=125 ROOM_SOAK_SECONDS=3600 pnpm --filter @game/server exec vitest run test/concurrent-rooms.test.ts
```

session72311、13:37:44開始、exit0、所要3608.74秒。生ログは[soak-100rooms-3600s.log](soak-100rooms-3600s.log)。

- 再戦3,500回、移動187,021回。100部屋ごとに8参加者。
- 各再戦で射撃、射手socket切断、同じidentity/generation更新で復帰、同一発射commandのduplicate拒否を確認。
- フレームのmatchId・8人rosterによる部屋分離、move ACK/手番進行、owner配信一致、接続/応答を確認。
- 終了時に全接続を閉じ、100部屋のファイル保存を再ロード。同一時刻へ進めた保存状態と復元battleのserialization一致を確認。
- 30iterationごとの観測値：RSS286〜633MB、heap74〜338MB。closed clientやrunnerを含む値。上昇/GCの周期があるため、サーバー単体のメモリリーク不在とは断定しない。

初回は対戦中owner変更の配信漏れで122秒で失敗。NodeとDOの配信を修正し、短時間再戦検証後にこの1時間を新規実行した。失敗した実行を完走扱いにしていない。

## この試験が証明しないこと

- 実Durable Objects/Directoryの容量、CPU、費用。
- 全clientの全fieldを毎frame比較した完全一致、描画済み状態の一致。
- 実ネットワークのpacket loss、複数地域/実機の遅延・fps。
- 射撃だけで自然決着する1時間試合。約100秒周期で降参決着から再戦し、復帰を繰り返すシナリオ。
