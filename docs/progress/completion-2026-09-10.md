# KEROPOD 完成までの実装ゴール

ユーザー指示：最後まで実装。UIの見た目は最後に承認済み原案へ合わせる。
現在のHUDは機能確認用であり、デザイン完成とは扱わない。
本番公開/mainへの反映は別の明示指示まで実施しない。

## 順序

- [ ] 1. 可変マップ・マップ選択・風をロビーから対戦・描画まで接続。全人数での配置と射程を検証。
- [ ] 2. 再接続・session generation・version固定・state復元と重複排除を完成。
- [ ] 3. Room単位の永続化、Directory、公開用routing、負荷/障害テスト。
- [ ] 4. 招待リンク、観戦、クイック参加、イントロ/復帰/音の一連の導線。
- [ ] 5. 配信用アセット登録・最適化、一般アバター、日英表示、診断/通報導線。
- [ ] 6. 全機能の縦断テストと長時間対戦/遅延/切断/再起動試験。
- [ ] 7. 最後にデザイン原案と実画面を照合し、全UIをブラッシュアップ。
- [ ] 8. 実装済み・検証済み・外部の実機/運用/公開判断を分けて報告。

正本：design/20〜23。ユーザーの最新指示（チームは色、Q/E、Tab、WASD/矢印、長い100分割パワー、円形角度計）を優先。
照準/パワーは23章の非公開方針を維持。夜間メモの照準配信TODOは設計本文と矛盾するため採用しない。

## 開始点

作業：game-world-ui / codex/2d-world-ui。世界UI・多人数コードはこのcheckoutが最新。
worldプレビュー、可変8人ルール、メモリ内部屋、移動同期、8武器同時tick再生、60秒復帰は既存。
生成原案：output/imagegen/game-screen-functional-v1/desktop-refined-v4.png。
heartbeatはUI共同調整時にPAUSED。本ゴールは現在のタスクで進行。
利用制限リセットの既存許可は最大2枚。使用済み0/2、実際に上限へ達したときだけ使う。

## 09:58 可変マップと風

- 苔の谷(500×225)・葦の丘(400×200)を登録。2〜8人の全配置を検証。
- owner限定のマップ選択。revision競合拒否、全ready解除、サーバー登録定義のみ許可。
- サーバー確定の初期surfaceを配信し、地形破壊、角度計、カメラ範囲、全体図を可変寸法へ接続。
- サーバー内部のwind PRNG stateを保持し、手番ごとに一度更新。公開frameは現在値のみ。弾道・HUD・落下物に反映。
- maps68、engine108、protocol22、server46、client170テストと4package TypeScriptを通過。
- PC＋タッチ2接続E2E：マップ変更、ready解除、風一致、装備、発射、結果、部屋復帰を通過。
- 射程・全武器の組合せ監査はまだ残る。マップstatusはtest-onlyを維持。

## 10:00 復元基盤

- BattleSnapshot v1を追加。初期surfaceと確定terrainOpsからmaskを復元し、replay/風のprivate state/移動receipts/lastFireを保存。
- JSON往復後の地形・再生・次ターン一致、移動と発射の二重適用防止、version不一致拒否の3テストを追加。engine111テスト・TypeScript通過。
- まだgatewayへの永続化接続は未完。次はsocket依存を分離した部屋reducerをNode/DOで共用し、persist-before-ackを実装。
- Cloudflare durable-objectsスキルとWebSocket hibernation / alarms公式仕様を確認済み。DOは部屋単位、Directory別、SQLite、WebSocket attachment、単一alarmで進める。

## 10:15 部屋単位の永続化と再起動復帰

- WebSocket非依存のRoom reducerへNode gatewayを接続。session generation、旧接続拒否、切断期限、所有者引継ぎを共用。
- RoomRuntimeは部屋単位に直列化し、保存成功後のみstate公開/ACK。保存失敗後の再試行をテスト。
- NodeはROOM_STORE_DIR（既定.keropod/rooms）の原子的ファイル保存から復元。tokenを含むローカル状態はGit対象外。
- 別のwrangler.v2.jsoncでRoomObject（各部屋）とRoomDirectory（一覧）をSQLite DOへ分離。既存本番Hubは変更していない。
- WebSocket hibernation attachment、単一alarmによる手番/切断/handshake/一覧更新、接続消失の照合を追加。
- /v2/roomsで作成・一覧、/v2/rooms/:idでWS接続。Origin制限。部屋コードはDirectoryから削除しても再利用しない。
- VITE_ROOM_SERVER_URLを設定すると画面がedge経路を使う。未設定ではNode8795。再接続用roomIdをsessionStorageへ保存。
- server53テスト、client172テスト、TypeScript通過。edge個別テストは実際のwrangler localで1件通過。
- ブラウザーPC+touch2接続のrooms E2EをNode/edge両方で通過。
- scripts/verify-edge-restart.ts: live socketのままSIGKILL→同じSQLiteで再起動→同じmatch/terrain、generation2、shot重複拒否を確認。
- 未完：version tuple、Directoryの地域/クイック参加・観戦、一般公開UIへの接続、負荷/長時間試験、最終UI。

## 10:25 招待と観戦

- room=6桁コードの招待URL。タイトルを省略し、名前/入室画面へ直行。共有URLからtokenや無関係なquery/hashを除去。
- プレイヤーとは別に観戦8席。観戦tokenはsession roleで権限分離し、ready/開始/移動/射撃/降参をサーバーで拒否。
- 観戦者の入退室ではroster/revision/readyを変えず、ownerにも選ばない。Directoryの人数はプレイヤーと観戦者を分離。
- 最新snapshotから観戦開始。発射/降参を非表示、Tabでカメラ巡回、手動視点維持を選択可能。脱落したプレイヤーも操作HUDを観戦表示へ切り替える。
- client174/server55テスト通過。PC+touch+観戦の3端末招待E2Eを追加し、既存rooms E2Eとともにedgeで通過。
- 後続：クイック参加（1v1/2v2・地域別）、version固定、公開画面への切替、日英/アバター/診断、負荷試験、最終UI。

## 10:38 クイック参加

- 1v1/2v2とasia/europe/americasを区別し、customと混ぜない。参加時の自動チーム配置、定員、編成変更拒否、全readyで自動開始。
- Directoryの10秒予約とNodeの処理中予約により同時参加の空席競合を抑止。Room reducerも最終定員を検証。
- 30秒後の地域変更/練習案内と待機キャンセルを追加。BOT補充や勝手なmode/region変更なし。
- RoomObject初期化RPC＋配置hint。既存の招待/復帰はDirectory照会なしで処理する。
- POST割当の512bytes制限、120回/分のIP Rate Limitを追加。共有IPとnamespaceの運用確認は32章に記載。
- server58/client175 unit、server/client/e2e TypeScript通過。edgeの同時予約/地域分離/全ready開始を実ランタイムで検証。
- Nodeで1v1/2v2/30秒キャンセル3 E2E通過。edgeで2v2/30秒キャンセル、既存招待/観戦/カスタム対戦を通過。
- 強制終了後のSQLite復帰も再実行して通過。edge1v1 E2Eは途中のコード更新による切断をログで確認後、固定状態で再実行して通過。

## 10:52 通信と保存状態のバージョン固定

- protocol/sim/assets/rulesとmap id/versionを試合に固定。入室・復帰時に一致しないクライアントを拒否し、更新案内を表示。
- BattleSnapshot v2へ移行。未公開v1の明示的な旧version移行のみ許可し、異なるsimやmap revisionの復元を拒否。
- セッションにもbuildを保存。未認証の不適合接続によるNodeの空室残留を防止。
- engine113/server59/protocol24/client175 unitとTypeScript通過。実SQLite edge2テスト、SIGKILL復帰、ブラウザー5 E2E（招待/観戦/custom/quick1v1/2v2/待機取消）通過。
- 次は通常起動経路と配信buildの検証。version文字列は手動管理のため、sim/rules/assets変更時に更新する運用が必要。

## 10:54 通常の起動経路

- `/`でKEROPODを起動。招待は直接部屋画面へ。旧UIはDEVのlegacy URLへ移動。
- プレビュー/固定8席試験の表示を配信用画面から除き、保存済み音量・muteを起動時に反映。
- 配信用buildの接続先未設定時は同一originのv2 API。開発用8795を公開クライアントへ埋め込まない。
- production build/previewの3 E2E、PC/横長touch/小型/縦画面と操作の7 E2E、client175 unit、TypeScriptを通過。
- 全配信ファイルは現状約16MB。画像軽量化とpack登録を次に行う。UIの最終デザイン調整は未着手。

## 10:57 配信画像の可逆圧縮

- 背景/地形/ロゴ/共通UIの11画像をruntime/world-v1へ登録。元PNGと生成記録は保持。
- RGBA全画素・寸法を完全一致で検証するWebPエンコーダーを追加。15,784,549→11,565,164 bytes（26.7%削減）。配信build全体は約16MB→12MB。
- manifestに元と出力のSHA-256、寸法、容量を記録。assets:checkで差し替え・更新漏れを検出。
- production3 E2E、地形破壊後のalpha E2E、TypeScript通過。
- spriteの正規pack登録と最終視覚レビューは未完。runtime画像登録は人間によるアート承認の代替ではない。
