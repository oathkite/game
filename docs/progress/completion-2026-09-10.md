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

## 11:00 イントロの再生導線

- 初回3秒の既存素材による演出、常時操作可能な開始/スキップ、設定からの再生を追加。
- 再訪・招待・reduced motion・saveDataでは省略。保存不可でも自動終了して開始できる。
- productionのイントロ3 E2E、既存world7 E2E、client/e2e TypeScript通過。
- 演出の最終的な機体ポーズ/ガレージ/ロゴの絵作りとidle motionはUI最終工程で照合する。今回は再生・省略・遷移の機能基盤。

## 11:04 オンライン対戦音

- サーバーのreplay時刻から発射/着弾/被弾、手番交代/終了音を再生。初期snapshot・再接続で過去音を再生しない。
- 同時tickの音をまとめ、500ms超の停止後のcatch-upを破棄。時計の後退補正でも重複しない。非表示中もイベントを消費し音は鳴らさない。
- 音声初期化が拒否されても開始導線を止めず、resume拒否の未処理Promiseを防止。
- client179 unit、client/e2e TypeScript、edgeのPC/touch対戦E2E（実Oscillator起動確認）、音声拒否production E2E通過。
- 音色の最終調整とローカル練習の音の統合確認、再接続UIの改善は残る。

## 11:09 対戦中の再接続

- 再接続時も対戦画面を保持し、新しいsocketのframeで接続を置き換える。接続中のボタン連打を抑止し、重複した再読み込み案内を除去。
- ブラウザーのclose後に再接続UIが出ない問題をedge E2Eで再現。DOのwebSocketCloseで明示的にclose応答すると同じ試験が通過。
- close応答はCloudflare公式のWebSocket best practicesでも許容される操作。local runtime差異に依存せず明示する。
- PC/touchの対戦→発射→socket切断→同一identityで再接続→降参→部屋復帰のE2E通過。client/server/e2e TypeScript通過。
- 練習の発射音はPrototypeCanvas→playReplayの既存経路を確認。音量とmuteの実操作確認は後続の横断試験に含める。

## 11:14 マップ・武器・編成の組合せ検証

- 2マップ×2〜8人×全8武器×power1/50/100の336射撃を追加検証。射撃受付、有限座標、HP範囲、mask寸法、replay終了、保存復元後の地形と次ターン一致を確認。
- 2〜8人の全整数分割（単一チームを除外）を両マップで確認。116通りすべてで全員が手番を持ち、ラウンド上限で終了。
- 追加15テスト通過、engine TypeScript確認。これは進行・保存の整合性の証拠で、射程/配置の公平性/武器バランスを証明するものではない。マップのtest-only状態を維持。

## 11:16 試合の診断情報

- 対戦メニューからmatchId/turnId/eventSeq/phase/serverTimeとbuild tupleを確認・コピーできるようにした。
- 明示的な許可項目だけをJSON化し、token・名前・未確定power/角度・余分な入れ子情報を除く。クリップボード拒否時は手動選択へ。
- 機密項目混入テスト、実edge対戦・切断復帰後の診断表示とtoken非包含E2E、TypeScript通過。
- この機能はローカルの診断情報出力。通報の送信先・運用処理やサーバー診断保存を実装済みとは扱わない。

## 11:20 日英切り替え基盤

- タイトル/ロビー/設定/カメラ設定/機体portraitの文言と武器名を日英対応。タイトルと設定に言語選択を設置。
- 保存済み選択を優先し、未設定時は日本語browser→ja、それ以外→en。HTML langも切り替える。保存拒否時も現在の画面は切替可能。
- client182 unit、production8 E2E（英語初期表示、日英変更、reload維持、設定切替を含む）、client/e2e TypeScript通過。
- 対戦ルーム/HUD/試合結果/エラーの翻訳は次の工程。日英対応全体を完了とは扱わない。

## 11:25 対戦ルームとメニューの日英対応

- 対戦ルームの作成/招待/観戦/地域/ready/装備/マップ、接続とエラー表示、対戦メニュー/診断、主要HUDラベル/結果を翻訳。
- 数値入りラベルはプレースホルダーで処理。名前やプロトコル値は翻訳しない。
- client183 unit、client/e2e TypeScript、英語2人quick対戦→診断→降参→結果E2E、日本語custom対戦→再接続E2E通過。
- 練習画面、メーター/カメラの読み上げラベル、残る状態表示の漏れを後続で監査する。

## 11:28 練習・メーター・カメラの翻訳

- パワー/角度計の読み上げ、フィールド・全体図・カメラ操作、素材読込案内、練習のメニュー・操作説明・結果を翻訳。
- 英語の配信用buildで練習→メーター/カメラ→メニュー→復帰を確認。言語保存テストとともに2 E2E通過、client/e2e TypeScript通過。
- client183 unitと明示的な翻訳キーに英語辞書が存在する追加テストを通過。辞書存在検査は未翻訳の直書き文言を網羅するものではない。

## 11:30 部屋の並行動作

- Node gatewayの実WebSocketを32本接続し、4部屋の8人対戦を同時開始する試験を追加。
- 各部屋で同じcommandIdによる同時発射、actor接続のterminate、generation2で同一identity復帰、同じ発射の重複拒否、次ターンを確認。
- 全クライアントの受信frameが所属matchId/8人rosterのみであることを確認。server TypeScriptと試験通過。
- これはローカル並行動作smoke test。DOの多数部屋負荷、帯域/RTT、長時間soak、世界各地域からの性能保証は別途必要。

## 11:33 試合全体の保存復元

- 両マップの8人・3チーム・混成武器で終了まで射撃を進める試験を追加。毎ターンの保存復元、地形のバイト一致、射撃重複拒否、状態/結果一致を確認。
- engine全130テスト、server全60テスト通過。通常runのedge2件は環境指定がないためskip（直近の実edge個別実行では通過済み）。engine TypeScript通過。
- 時刻を進める決定論的シミュレーション試験であり、実時間soakの代替とは扱わない。

## 11:36 チーム表示の色統一

- チーム選択のA/B表記を8色の色名と選択色帯へ変更。HUDの読み上げとオンライン/練習の勝利表示も同じ色名を使用。
- 内部t0〜t7や編成ルールは変更しない。色名は日英辞書へ登録。
- 色/翻訳unit、client/e2e TypeScript、日本語custom対戦・復帰と英語quick対戦の2 E2E通過。

## 11:40 音設定の共通化

- 設定/練習メニュー/オンラインメニューで同じAudioControlsを使用。音量とmuteを即時反映し、profileへ保存。
- 練習中muteが保存されない不一致を解消。保存時は最新profileへ音設定だけを上書きし、名前/装備を巻き戻さない。
- 英語productionで練習の音変更→設定画面→reload維持を含む3 E2E、PC/touchオンライン対戦E2E、client/e2e TypeScript通過。

## 11:51 プレイヤー通報

- 対戦メニューへ対象・理由を選ぶ通報フォームを追加。日英対応。認証済み参加者/観戦者から受け付け、保存成功後のみ受付を返す。
- 対象名はサーバー由来。8項目の明示allowlistで保存し、接続tokenや公開frameには混ぜない。同じ試合/報告者/対象は重複追加しない。
- 上限256件、7日保持。全員退出後も保存し、Node tick/DO alarmで期限切れを削除する。
- server全65件通過後、空室ファイル保持/削除を追加し関連7件通過。edge2件、実edgeに対する英語通報/重複受付E2E、server/client/e2e TypeScript通過。
- 公開前に運営の確認担当・頻度・対応基準を決める。受付機能は自動処分や運営対応完了を意味しない。

## 11:56 オンライン内のシーン演出補完

- 既存の対戦開始/部屋復帰フェードを確認。演出がなかった入室（entry→部屋）とオンライン結果表示に同じ240msフェードを適用。
- RoomScreenの通信管理は再マウントせず、表示sectionのみroomIdで切り替える。readyや通常frameの更新ではkeyが変わらない。通信時計/サーバー進行に待機時間を追加しない。
- 先行E2Eで結果のanimation-name=noneを再現後、英語quick/日本語custom対戦・復帰・再準備の2 E2E通過。reduced-motionの結果演出無効を検証。client/e2e TypeScriptとdiff check通過。
- これは機能上の演出漏れの補完。最終的な視覚表現の承認・原案への整合は最後のUI工程に残る。

## 11:56 全ワークスペース検証

- `pnpm test`完走：protocol24 / sim107 / maps68 / engine130 / client185 / server66、合計580件通過。serverのedge2件はこの通常runでは環境未指定でskip（直前の個別edge実行は通過）。asset unit/checkもコマンド成功。
- `pnpm typecheck`で全7package完走。production.config.tsの10 E2Eも全通過。通常入口・招待・同一origin routing・イントロ・音初期化失敗・日英・練習音設定を実buildで確認。
- asset checkは明示的に `No production asset packs yet; art delivery is incomplete.` を出している。コマンド成功を素材納品完了とは扱わない。配信用sprite pack登録が残る。
- 設計23章の残項目を再確認：RTT300ms超の表示が未実装。100同時部屋/800人の容量gate、長時間/遅延下の観測試験、実DO CPU計測、実機/複数地域試験は未達。4部屋32接続の既存試験で代替しない。
- 次に通信遅延の計測/表示と負荷試験を実装し、素材登録・残る画面要件を埋めてから最終UI整合へ進む。

## 11:58 通信遅延の計測と表示

- 認証済みroom.ping/pongを追加。nonceだけを応答し、状態変更・保存・全員への配信を行わない。既存の入力rate limit内で扱う。
- 対戦/観戦の現在socketで5秒ごとにRTT計測。performance.nowで往復を測り、異なるnonce/古い応答を無視する。切断・再接続・未応答時の古い値をクリア。
- 300ms超は戦場の小さな表示、通常値は対戦メニューに表示。日英対応。背景タブで計測送信しない。対戦時計・物理・補間は変更しない。
- server67件、latency unit、server/client/e2e TypeScript、実edgeの英語対戦でRTT表示→通報→結果E2E通過。RTT表示は相手の描画遅延SLOの計測とは別。
