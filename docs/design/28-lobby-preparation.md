# v2 ロビー準備の状態処理

## 実装した境界

engineのlobby.tsに、2〜8人の参加・退出・接続状態・チーム配置・装備・ready・開始判定を分離した。
WebSocket入口と新UIからの部屋作成/参加はまだ接続していない。既存の固定8席labは引き続き独立した試験である。

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
- engine104、server45、protocol22、workspace typecheck成功。
- 画面変更なし。正式な複数部屋WebSocket/新UI/再接続と試合結果から部屋へ戻る処理は未接続。

## 次工程

server側で部屋を分離し、接続の認証PlayerIdからだけ状態操作を呼ぶ。
部屋を変更するmessageのroomIdを接続中のroomに照合し、他部屋のstateや開始snapshotを配信しない。
新UIに招待code・チーム配置・装備・ready・開始待機を追加し、2〜8ブラウザで分離と試合開始を確認する。
マップ選択は登録済みcatalogから解決し、変更時には全員のreadyを解除する。clientからMapSpec本体は受け付けない。
