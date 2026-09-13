# v2 ロビー準備の状態処理

## 実装した境界

engineのlobby.tsに、2〜8人の参加・退出・接続状態・チーム配置・装備・ready・開始判定を分離した。
DEV WebSocket入口と新UIを接続した。部屋作成→6桁code参加→チーム/装備→ready→開始→結果→同じ部屋の準備へ戻る。固定8席labも独立した試験として残す。

- 所属はt0〜t7。未配置はnull。2人以上、2チーム以上、全員配置/接続/readyでownerのみ開始できる。
- readyは編成revisionへ紐付く。ready自体と表示名の変更はrevisionを増やさない。
- 入退室、接続変更、チーム、装備変更はrevisionを増やし全員readyを解除する。同値の再送は編成を変えない。
- 本人は自身のチーム/装備を変更でき、ownerは他人のチームも変更できる。部外者・切断中・別部屋・古いrevisionは拒否する。
- owner退出/切断時は参加順で最古の接続中参加者へ移譲。接続者0ならownerなしとし、再接続時に再選出する。
- 開始後の編成変更/再開始/入退室処理は拒否する。対戦中の退出はbattle surrenderへ送る責務がgateway側にある。

## 開始snapshot

PreparedMatchへ参加者/所属/表示名/loadout、MapSpec、room revision、ruleSetVersion=keropod-v2.1をコピーする。
createPreparedSessionはこのsnapshotから試合を生成する。BattleSessionは各人のloadoutを保持し、fireは本人の固定slotを参照する。
未指定のlabは従来のcannon/diggerを維持。射撃のweaponは結果にも保持し、再生packetはslot番号から武器を推測しない。
MapSpecの対応人数と安全なspawnを開始前に検証する。現時点のmapはtest-onlyであり、公開用バランス検証は別工程。

## 検証

- ロビーの8テストに、全58編成の開始、ready解除、stale revision、権限、退出/復帰、8人上限、map非対応、装備固定から3本の弾道まで含む。
- engine104、server46、client165、protocol22、workspace typecheck/build成功。
- 実WebSocketで別部屋への操作拒否と配信分離、選択装備、同じPlayerIdへのtoken復帰、接続中tokenの横取り拒否、対戦中参加拒否、owner退出後の結果から準備復帰を確認。
- 独立2ブラウザで部屋作成/参加/ready解除/射撃/結果/準備復帰。PC1440×900、横844×390と667×375の主要操作44px以上。
- world E2E5、固定8席world-network E2E1の回帰も成功。

## 通信と起動

`pnpm --filter @game/server exec tsx src/rooms/main.ts` でloopback8795、許可Originはlocalhost/127.0.0.1:5186。
画面は `http://127.0.0.1:5186/?prototype=world` → オンライン試験。
接続のPlayerIdをserverで発行し、tokenは本人だけへ送る。切断後60秒の復帰を許可し、期限後は退出/降参へ進める。
同時期限切れはまとめて脱落を判定。待機中の退出は席を除去、試合中は確定rosterを保って降参する。
結果後はownerが全員を同じ部屋の準備へ戻せる。readyは解除される。owner退出時は接続中の参加者へ移譲。

DEVのみ、メモリ内の部屋でserver再起動時には消える。最大256接続sessionの暫定上限。固定test map/風0。

## 次工程

マップ選択は登録済みcatalogから解決し、変更時には全員のreadyを解除する。clientからMapSpec本体は受け付けない。
8人の実機操作、低速回線、期限切れのブラウザ試験、照準の逐次同期、風と公開用map、永続化と本番gatewayを進める。
