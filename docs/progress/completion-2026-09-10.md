# KEROPOD 完成までの実装ゴール

ユーザー指示：最後まで実装。UIの見た目は最後に承認済み原案へ合わせる。
現在のHUDは機能確認用であり、デザイン完成とは扱わない。
本番公開/mainへの反映は別の明示指示まで実施しない。

## 順序

- [x] 1. 可変マップ・マップ選択・風をロビーから対戦・描画まで接続。全人数での配置と射程を検証。
- [x] 2. 再接続・session generation・version固定・state復元と重複排除を完成。
- [ ] 3. Room単位の永続化、Directory、公開用routing、負荷/障害テスト。
- [x] 4. 招待リンク、観戦、クイック参加、イントロ/復帰/音の一連の導線。
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

## 12:01 100部屋・800接続の整合性試験

- 既存の同時接続テストをROOM_LOAD_COUNT=1..100で実行可能にした（通常4部屋）。全接続への移動反映確認も追加。
- 100部屋試験がcapacityで失敗し、custom作成だけの旧256セッション制限を特定。quickと同じ128部屋上限へ統一、各部屋の8+8定員は維持。
- 100部屋/800接続で同時移動→射撃→各actorの強制切断→generation2復帰→重複射撃拒否→次手番、全frameの部屋分離を通過（3.60秒）。server67件とTypeScriptも通過。
- Nodeメモリ保存の短時間整合性試験。DO/Directory/永続I/Oを含む100部屋の公開容量gateや長時間soakは未達のまま。

## 12:03 100部屋の実ファイル保存と復元

- ROOM_LOAD_PERSIST=1で同時接続テストを実ファイル保存へ切替可能にした。通常のメモリ試験は維持。
- 100部屋/800接続の移動・射撃・復帰後、全接続の切断保存を待ち、全100室のファイルを読み直してBattleSnapshot全体の一致を検証。
- 永続I/O条件の100部屋試験は4.28秒で通過。server TypeScript/diff check通過。セッションを含む一時ディレクトリはテスト終了時に削除。
- これはローカル短時間I/O試験。長時間soak、遅延下の対戦、実DO/Directoryの容量測定は引き続き未達。

## 12:04 遅延下の100部屋対戦

- 同時接続試験に片道0〜500msの送受信通知遅延を追加。ping応答が設定往復時間より早くならないことも検証。
- 100部屋/800接続、ファイル保存あり、片道125ms（往復250ms相当）で移動/射撃/切断復帰/重複拒否/全室の保存復元一致を通過（6.92秒）。通常4部屋の遅延なし試験、server TypeScript、diff checkも通過。
- 遅延はクライアント送信と受信通知への挿入。TCP損失/帯域制約/画面描画を含まないため、相手移動表示p95の根拠にはしない。長時間/実機/実DO gateは残る。

## 12:07 長時間試験の実行開始

- ROOM_SOAK_SECONDS（0〜600）で初期対戦検証後の接続維持/全接続ping/手番内移動/期限進行/保存復元確認を追加。
- 4部屋、実ファイル保存、片道125ms、継続10秒の試運転とserver TypeScript/diff check通過。実際に移動を送った回数もassertし、待機だけで成功しないようにした。
- 100部屋/800接続、実ファイル保存、片道125ms、継続600秒を開始。結果はまだ未確認。ログ `/tmp/keropod-soak-600.log`、実行session25911。既存handleをpollし、終了確認前に再起動しない。

## 12:09 タンク画像の配信元を固定

- spriteTankが使う11枚をassets/runtime/tanks-v1へ無加工で分離。制作フォルダーからの直接読み込みを解消。
- 再作成scriptとmanifestを追加。assets:checkで元画像とのバイト一致/ハッシュ/サイズを検査。画像の見た目・密度は変更なし。
- assets:check、client TypeScript、配信buildの入口/練習/招待/routingの3 E2E通過。
- 視覚承認はpendingを明記。assets/sprites向けの人による最終承認や、全VFX/アニメーション統合は未完。
- 10分soakはsession25911で継続中。96秒時点100部屋、テスト全体RSS445MB。完了結果は未確認。

## 12:12 タンクの状態別フレーム同期

- 既存画像のidle（まばたき）/move/low-hp/hit/wreckを状態別に選ぶ小さなフレーム選択器へ分離。移動開始を先頭フレームへ揃え、初期表示の移動誤判定を解消。
- 既存packのidle1200ms/move100ms/low-hp1600msを採用。低HPは25以下、被弾/撃破を優先。reduced-motionではコマ循環を止めて状態は表示する。
- 状態遷移/各ポーズ/移動停止猶予/reduced-motionの3 unit、client TypeScript/diff check通過。配信buildの入口/練習/招待3 E2E通過（reduced-motion追加前）。最終アート比較や全VFX/落下同期の完了とは扱わない。
- 100部屋soakはsession25911で継続。243秒時点RSS619MB（テストクライアント込み）。増加傾向があるため完了後に判定し、現時点で安定性合格とは扱わない。

## 12:16 初期配置間のキャノン射程

- 両マップの2〜8人、全初期位置の全方向ペア（336組）に対し、無風のキャノンで対象へ正の爆発ダメージを与える射角/パワーが存在することを検証。
- 仰角15/30/45/60/75、左右、パワー10〜100（5刻み）を探索。単なるHP変化ではなく、指定対象へのimpact.damageを確認。
- 2 tests/336ペアが通過（0.59秒）、engine TypeScript/diff check通過。任意のチーム配置で敵が遠方にいる場合の基礎射程を確認できた。
- 無風キャノンの到達性の証拠。全武器・風・破壊後地形の戦術バランス、公平な勝率の証拠ではなく、map statusのtest-onlyは維持。

## 12:18 10分間の整合性試験完走とメモリ切り分け

- 初回100部屋/800接続・ファイル保存・片道125ms・600秒の試験が完走（607.56秒）。接続維持・期限進行・移動・全室の保存復元一致を確認。
- RSSは47秒403MB→586秒951MB。整合性は通過したが、メモリ安定性は未合格。
- インストール済みVitest3.2.7のcreateExpectPollを確認し、各呼び出しがtest.onFinishedへクロージャを追加することを確認。長時間ループで呼び続けるためテスト保持の影響が疑われる。
- 試験のpollを期限付きの通常Promise待機＋最終同期assertへ変更。失敗条件/timeoutは維持し、RSSに加えてheapUsedを記録。4部屋/10秒の同条件試運転・server TypeScript/diff check通過。
- 同じ100部屋/600秒の比較試験を開始。ログ `/tmp/keropod-soak-bounded.log`。結果未確認。元の951MB増加をサーバーのリークとも試験だけの問題とも断定しない。

## 12:21 オンライン着弾の生成素材接続

- 生成済みeffect-explosionの4コマを確認し、配信用コピーとハッシュ検査へ追加。オンライン射撃のProjectile containerへ再利用するSpriteとして接続。
- impact.tickを既存replay時刻へ変換し、地形削りと同時に開始。確保済みの300ms settling内に4コマを表示し、遅れて届いた過去の爆発は再開しない。
- 正のdamageを受けた機体を最初の150msだけflash表示。reduced-motionでは爆発のコマ変化を止める。物理や対戦時計は変更なし。
- タイミング/過去再生防止を含むlabReplay4件、client TypeScript、assets check、実edgeのPC/touch射撃・復帰・再準備E2E通過。
- 全武器固有VFX・練習側との演出統一と最終視覚比較は残る。
- 比較soakはsession22808で継続。146秒時点RSS351MB/heap84MB（初回は145秒RSS484MB）。完了まで安定性の判定は保留。

## 12:24 武器別の着弾素材

- 既存energy/drill/digの4コマ画像を目視し、配信用コピーとハッシュ検査へ追加。レーザー/ドリル/地中攻撃に割り当て、その他5武器は通常爆発を使う。
- 同じ着弾tick/300ms再生/再利用Sprite処理で表示。ダメージ・地形・弾道は変更なし。
- 素材15件の一致検査、labReplay4件、client TypeScript/diff check、実edgeのPC/touch射撃・復帰・再準備E2E通過。E2Eの実射撃はtripleで、特殊3種の視覚確認はソース画像と割当確認まで。
- 比較soakはsession22808で継続。294秒RSS297MB/heap64MB。初回同時刻RSS605MBより低く、終了時まで観測を続ける。

## 12:27 砲弾素材の共通描画

- 8武器の砲弾を配信用コピーへ追加。共有projectileViewが任意のTextureを受け取り、練習/オンラインで同じ画像を使用。従来の呼出しには既存描画を維持。
- 元素材のorigin[96,96]、12px/cell、nearest samplingで配置。オンラインの弾道区間から進行角を算出し、画像を回転。弾道/ダメージ/地形は変更なし。
- assets23件の一致検査、labReplay4件（方向角を含む）、client TypeScript/diff check、実edgeの対戦1件と配信buildの入口/練習/招待3件が通過。
- 比較soakはsession22808で継続。442秒RSS227MB/heap72MB。完了後に初回とまとめて比較する。

## 12:31 着弾描画の共通化とsoak比較修正

- 着弾Texture選択を共通projectileViewへ移し、練習/オンラインに同じ武器別素材を接続。既存の各再生時計と地形/ダメージ処理は維持。専用Sprite描画の重複を除去。
- client190件、client TypeScript、worldの7 E2Eと実edge対戦1 E2E通過。Texture recordの型不一致を修正し型検査を再通過。
- 2回目10分soakは接続/移動を完走したが、最後の保存復元比較で失敗。読み込み時に手番期限を越えたため31→32と風更新が発生。fileRoomStore.loadがtickRoomを適用する仕様に対し、保存時そのままを期待していた試験の誤り。
- 同じ復元時刻でtickした期待stateと比較するよう修正。期限をまたぐfile loadの独立テストを追加し、file store3件と短時間soak/server TypeScript通過。
- メモリ比較は初回586秒RSS951MBに対し、2回目590秒RSS223MB/heap83MB。pollの終了時保持を避けることで増加傾向が解消する証拠。ただし2回目test全体は未合格と記録。
- 修正版100部屋/600秒をsession28045で開始。ログ `/tmp/keropod-soak-final.log`。既存の22808は終了済み。

## 12:36 初期画面のWebGL除去と遅延読込

- タイトル/ロビー/結果の機体プレビューを同じPNG層・アンカー・倍率のSVG合成へ変更し、プレビューだけのPixi Application生成を除去。全4画像のload完了をdata-loadedへ反映。
- 対戦/練習/部屋画面をReact.lazy/Suspenseで分割。WorldScenesの単一build片は496KB→13KB。ただし共通chunkを含む総転送削減量とは扱わない。
- production10件通過後、タイトルのWebGL要求0→練習の描画開始をassertする入口試験3件も通過。4画面サイズ+地形のworld5件、client/e2e TypeScript通過。
- 速くなったプレビューでスクリーンショットがシャッター途中を撮る問題を確認し、ロビー撮影前に演出終了を待つよう修正。1440pxの撮影を再実行してSVG合成を目視確認。
- 背景1,454,374B＋ロゴ775,426Bだけで2,229,800B。タイトル必須転送2MB目安は未達。最終UI素材整理時に継続改善し、今回のコード分割で達成したとは扱わない。

## 12:38 画面コードの取得失敗からの復帰

- 遅延ロードする画面をSceneBoundaryで保護。取得失敗時は日英の案内と再読み込みボタンを出す。
- 配信buildでCameraPrototype chunkを意図的にabortし、エラー表示→通信復旧→再読み込み→練習描画までのE2Eを追加。
- 入口/招待/routing/取得失敗復帰の4 E2E、client/e2e TypeScript/diff check通過。
- 100部屋の修正版soak（session28045）は440秒時点RSS252MB/heap90MBで継続中。まだ最終合格とは扱わない。

## 12:41 長時間・オンライン導線・風あり射程の確認

- 修正版の100部屋/800接続・実ファイル保存・片道125ms・600秒試験が、期限を考慮した全室復元一致まで通過（607.38秒）。
- 記録したRSSは47秒417MB→588秒250MB、heapUsed59〜90MB。初回の単調な増加傾向は再現せず、同じプロセス内のVitest poll保持の影響を避けた条件で完走。実DO容量やブラウザー描画のSLOとは別のローカル検証。
- 遅延ロード後のオンラインE2E全6件通過：英語対戦/通報/診断、招待/観戦、quick1v1/2v2、30秒待機とキャンセル、PC/touch対戦/切断復帰/再準備。
- 無風/左最大風/右最大風で両マップ2〜8人の全配置ペア1,008組のキャノン到達性を通過。engine TypeScript/diff check通過。戦術バランス・勝率の保証とは区別する。
- 順序1/2/4をローカル機能検証完了として更新。3/5/6は実環境gateや最終素材/検証を含むため未完を維持。原案desktop-refined-v4.pngを再確認し、機能を維持した最終UI照合へ進む。

## 最終UI照合：参加者と風表示の配置

- 参加者を中央タイマーの左右へ均等分割し、PCではランタイム素材の機体ポートレートを表示。狭い画面では省略して既存操作領域を維持。
- 手番の輪郭を原案のシアンへ合わせ、風をフィールド左上の暗色パネルへ移動。チーム表現は色を維持。
- client TypeScript、world E2E7件が通過。最後のCSS調整後にも4画面サイズと地形の5件を再実行して通過し、1440px/667pxの戦闘画像を目視確認。
- 原案との最終一致は未完。次はコックピット素材・背景/地形の画素密度・全シーンの統一とタイトル転送量を調整する。

## 最終UI照合：コックピットの枠と自機パネル

- 濃紺の金属面と細い縁のSVGコックピット枠を作成し、下部コンソールへ組み込み。PCの自機パネルに既存ランタイム素材の機体を追加。
- 狭い画面とtouch UIでは自機画像を省略。100段階パワー目盛り・円形角度計・操作キーを維持。
- client TypeScript、world E2E7件、diff check通過。1440px/667pxの戦闘画像で枠・自機・計器・touchボタンの表示を目視確認。
- 地形は現在8 texels/cell、機体は12 art px/cell。地形を単純に12へ上げると最大マップで6000px幅のテクスチャになるため、次に分割描画と画素密度を検討する。原案の地形/背景・各シーンの最終照合は継続。

## 最終UI照合：地形の画素密度と分割描画

- 地形を機体と同じ12 art px/cellへ変更。128セル単位のContainer内Spriteで描き、各テクスチャの幅/高さを1536px以内に制限。物理マスクは変更せず、模様の原点を世界座標へ固定。
- 先に分割境界の破壊・alpha一致・サイズ制限のE2Eを追加して旧実装で失敗を確認。実装後、6分割全画素のalpha一致と模様の連続性、通常地形の白色を通過。
- client/e2e TypeScript、world7件、追加の境界検証再実行、オンラインのPC/touch射撃・切断復帰・再準備E2Eが通過。1440pxの地形を目視確認。
- 総テクセル数は従来の2.25倍。分割は1枚の大きさの制限であり、総GPUメモリ削減や実機FPS達成を意味しない。最終実機性能gateは維持。背景/地形素材そのものの原案照合は引き続き必要。

## 最終UI照合：浮島と城の背景

- 原案desktop-refined-v4を参照してbuilt-in image generationで背景専用素材を生成。青空・遠景の城・浮島・滝・水面を含み、UI/キャラクター/前景地形を除外。生成元とAIレビューをworkbench/world-ui-final/READMEに記録。人間の最終承認は未記録。
- 元素材を保持して新バージョンを追加し、lossless WebPへ変換して既存背景の参照へ組み込み。11素材のRGBA完全一致とassets:check通過。
- world画面4サイズ＋地形の5 E2E通過。1440px戦闘と390pxタイトル/イントロの画像を目視確認。
- 新背景は1,731,642B。ロゴと合わせて2,507,068Bで、タイトル2MB目安は依然未達。最終アセット軽量化を継続する。

## 最終UI照合：共通パネルの統一

- 共通PixelPanelを戦闘画面と同じ濃紺のSVG金属枠へ統一。ロビー/設定/部屋画面の文字を明色にし、見出し・機体プレビュー・リザルト説明も青灰色の縁へ統一。主要ボタンの黄色と入力面の明色を保持。
- world4画面サイズ＋地形の5件、オンラインPC/touchの部屋準備・射撃・再接続・再準備の1件が通過。1440pxロビーと667px設定で背景上の可読性を目視確認。diff check通過。
- 背景/原案との全体比較、転送量最適化、最終検証と公開前判断事項の整理は継続。

## タイトル初期転送量の目標達成

- cold browserのnavigation/resource encodedBodySize合計に2,000,000B上限を設定し、旧素材で3,804,217Bの失敗を確認。背景と共通ボタンをWebP quality94へ変更。元PNG保持、寸法/alpha完全一致、RGB各RMS6/255以下をPythonで実検証。残り9素材は従来byte列を維持。
- manifest v2で素材別encoding/画素誤差を記録。Nodeはhash/容量/記録を検証し、Python checkで画素差を再計算する。背景/ボタンを画像表示でレビュー。
- 最終設定の配信build初期転送1,861,003Bで上限通過。cold cache相当の新ブラウザーcontext、ローカルpreviewのencoded body合計であり、実地域の起動時間を保証しない。
- production全11 E2E通過後、可逆素材のencode設定を従来へ戻して差分を絞り、入口/転送/練習のテストを再実行して通過。e2e TypeScript、assets:check、Python fidelity check、diff check通過。
- 次は最初の対戦までの累計8MBと残要件の最終照合。人間の最終アート承認/実環境SLO/公開運用判断は未完を維持。

## 初回練習の転送量と残要件の照合

- 配信buildのタイトル→ロビー→練習までのencoded body累計5,294,817B。8MB上限assertを追加して通過。タイトル1,861,002B、e2e TypeScript/diff checkも通過。
- final-audit-2026-09-10.mdへ正本20〜23の残要件を整理。8ブラウザー完走はserver/engine/少人数browser試験の合算では証明できず、1時間soakも既存600秒上限では未達。次の実装・検証として継続。
- 実機・実DO容量/費用・運用/法務・人間art承認を外部判断として区別。本ゴールは未完のまま。

## 独立8ブラウザーで4対4の縦断確認

- 8つの独立BrowserContext（保存領域/接続分離）で入室、4v4編成、準備、8名HUD、1名だけ操作可能、全接続で射撃再生→操作復帰を検証。
- 青4名の降参で全8名が赤チーム勝利を表示し、ownerの部屋復帰で全員8名の準備画面へ戻ることを通過。射撃だけで決着する長時間対戦と区別する。
- 目視でオンライン画面のSVG共通marginが小さなポートレートをずらす問題を確認。network-lab直下SVGへ限定し、画像が枠内に収まるassertを追加。修正後再実行31.3秒で通過、画像も確認。
- e2e TypeScript/diff check通過。1時間soakと配信版8人転送量は継続。

## 配信buildの8人対戦と転送量

- production-rooms.config.tsを追加。専用local Wrangler8798（保存先.keropod/e2e-production）と配信build/preview5186を自動起動・終了する。既存local edge8796と分離し、本番には接続しない。
- 8名が通常タイトル→ロビー→オンラインへ進む経路に変更。各独立contextで戦場読込までのencoded body累計を測り、5,296,962〜5,296,963Bで8MB以下を確認。
- 同じ配信buildで射撃共有、降参決着、全員同じ結果、8名部屋復帰まで29.4秒で通過。e2e TypeScript/diff check通過。
- 実行: `pnpm --filter @game/e2e exec playwright test --config production-rooms.config.ts`。5186が使用中ならこのcheckoutの開発serverを止めて実行する。1時間soak・実機/運用ゲートは継続。

## 1時間soakの開始（実行中）

- concurrent-rooms試験を最大3600秒へ拡張。開始時と60ループごとに一方のチームが降参→部屋復帰→全ready→再戦し、毎試合射撃中の切断/世代更新/同一射撃duplicate拒否を再検証。接続ごとのmatch分離、移動ACK、終了時の保存/復元一致を維持。
- ping nonceを実行中に再利用しないよう変更。短時間の4部屋/100部屋・実保存・片道125ms・15秒soakは通過（100部屋:100再戦/700移動、23.02秒）。server TypeScript/diff check通過。
- 1時間実行: session **90534**、ログ `/tmp/keropod-soak-3600.log`。`ROOM_LOAD_COUNT=100 ROOM_LOAD_PERSIST=1 ROOM_LOAD_DELAY_MS=125 ROOM_SOAK_SECONDS=3600 pnpm --filter @game/server exec vitest run test/concurrent-rooms.test.ts`。起動を確認した段階であり、完走/合格ではない。
- 再戦は降参決着。自然な20分上限の連続完走や実DOの1時間容量・実機描画を同時に証明したとは扱わない。引き続き同じsessionを監視し、観測タイムアウトだけで再起動しない。

## Firefox/WebKit検証の追加と未解決事項

- production.config.tsにChromium/Firefox/WebKit projectsを追加。Playwright管理Firefox153.0/WebKit26.5を導入し、配信buildで22件を実行。Firefox11/11、WebKit10/11通過。
- WebKitはdynamic chunkをabortした後、再読み込みしてもCameraPrototypeを再取得せずエラー画面へ戻る。HTTP traceで再取得なしを確認。query付きdocument再遷移・connectionreset・route維持も改善せず、実験的な変更は残さない。未解決であり全browser合格ではない。
- `pnpm --filter @game/e2e exec playwright test --config production.config.ts --project=webkit --grep "failed battle chunk"`で再現。実iOS/Safari/Androidの代替証明とは扱わない。

## 長時間試験で見つけたオーナー交代配信の修正

- 初回1時間試験90534は122秒で失敗して停止。4部屋125秒は通過したが100部屋125秒で再現し、既存接続と復帰接続のownerId不一致、not-owner-or-not-finishedを確認。
- 原因は対戦中のbroadcastがlab.frameだけで、切断によるlobby.ownerId変更を既存接続へ配信していなかったこと。Node/DOともlobby参照が変わったときだけroom.snapshotを先行配信し、毎tickの重複配信を避けた。
- 復帰後の全接続ownerId一致をassert。修正後100部屋・125秒・実保存・片道125msで200再戦/6500移動、保存復元一致まで通過（131.91秒）。server68件/TypeScriptと配信版8ブラウザー対戦通過。
- 修正版1時間試験は **session72311**、ログ `/tmp/keropod-soak-3600-owner-fix.log` で開始。90534/52939/80269/85978は終了済み。新実行はまだ合格扱いにしない。

## WebKitの画面コード再取得を修正

- 再読み込み時にsceneRetryを付け、通常importが再び失敗した場合だけbuild manifestから画面entryを新しいquery付きURLで取得。通常のVite依存/CSS preloadを先に通し、通常起動の追加取得を避ける。
- manifestはassets/chunks.jsonとして配信。RoomScreen/NetworkLab/CameraPrototypeが対象。同一origin assets内のJSのみを解決し、manifest取得失敗は既存エラー画面で再試行可能。
- WebKitの再現試験を2回連続失敗→通信復旧→再読み込み→練習表示・高さ確認へ拡張。Chromium/Firefox/WebKit全33 E2E、client/e2e TypeScript/diff check通過。
- Chromiumタイトル1,861,268B、初回練習5,295,079Bで転送目標を維持。実Safari/iOSの確認は別途必要。
- 1時間soak72311は258秒時点RSS465MB/heap74MBで実行中。まだ完走扱いにしない。

## Firefox/WebKitの配信版8人オンライン対戦

- production-rooms.config.tsにも3 browser projectsを追加。FirefoxとWebKitで独立8 contextの4v4準備・射撃共有・降参決着・8名部屋復帰を通過。
- Firefox16.0秒、WebKit約1.9分で試験完了。自動操作8 contextの総経過時間であり、1ユーザーの描画/入室SLOへ読み替えない。
- Firefoxの累計転送5,266,930〜5,266,969B、WebKit5,267,423Bで全接続8MB以内。e2e TypeScript/diff check通過。実iOS/Android/Safari/Edgeは引き続き別gate。
- soak72311は415秒時点RSS458MB/heap195MBで実行中。完走未確認。

## 地形のdirty chunk更新

- 区画ごとの前回alphaと直上の1行を保持し、内容が変わった区画だけCanvas再描画とTextureSource更新を行う。直上行も比較して、境界の上が削れたときの苔の縁を更新。
- 先に旧実装で全6区画が更新される失敗を確認。修正後、1セル破壊で1区画のみ・同じmaskで更新0・境界破壊で当該と下側の2区画・苔の実画素を検証して通過。
- world全8 E2E、client/e2e TypeScript/diff check通過。これは転送回数削減の検証であり、実機60fps保証とは区別する。
- soak72311は725秒時点RSS491MB/heap209MBで継続中。完走未確認。

### 低速回線でのcold start計測

- startup.config.tsを分離し、Chromium CDPで10Mbps・latency150ms、毎回新context/cache無効の20回を測定。navigation開始から開始ボタンが表示・有効・中央hit test可能になるまでをrequestAnimationFrameで記録し、実クリックでロビーへ進めることも全回確認。
- p95=684.1ms、最大690.3ms。ローカルproduction配信の開始操作可能3秒条件を通過。画像の完全ロード・実端末CPU・実地域DNS/TLS時間の測定ではない。
- 初回設定で既存3browser projectsが合成されCDP非対応2件が失敗したため、Chromium専用設定に修正。正式再実行は1件通過。E2E型検査対象へ専用設定とtestを追加。

### 対戦描画の残骸姿勢を接続

- design/15で決めた残骸の沈み込みと砲身の垂れ下がりが、runtime SpriteTankには未接続だった。履帯と車体を別Containerにし、撃破時は車体・搭乗者・キャノピー・砲台を8 artpx沈め、砲身を18度下向きへ固定。照準ガイドも非表示にする。
- 生存時は通常位置・照準へ復帰。物理座標・履帯の接地位置は変更しない。
- wreck.spec.tsで実Pixiオブジェクトを読み、撃破姿勢、接地不変、左右/元の照準角からの独立、通常状態への復帰を検証。変更前の不成立を確認してから実装。
- 残るアニメーション照合：runtimeでは落下/着地、発射反動/砲口VFX、大破遷移/残骸のグレースケールなど、素材ガレージ側の仕様と接続状況を引き続き比較する。この修正だけで全アニメーション完了とはしない。
- 検証：world E2E全9件通過、client/e2e typecheck通過。1時間soakは同じsession72311で1294秒まで進行、まだ完走判定しない。

### 落下・着地姿勢とオンライン残骸表示

- 対戦用TankPoseへfallingを追加。練習のstepFallとオンラインのauthoritative settlement区間から明示する。坂道上の移動座標から落下を推測しない。
- baseline-v2のpilot 11（落下）、12→0（着地150+30ms）を接続。落下から離れた時点で着地時計を開始し、撃破/被弾の優先を維持する。物理位置をアニメーションで再補間しない。
- NetworkFieldでeliminatedを一律非表示にしていたため残骸姿勢が表示されなかった。場外のy判定を維持し、地上の撃破機体は残骸として残す。
- 検証：新しいfall/landing unitを先に失敗確認、client全191件通過。その後online settlementの下降対象限定/境界解除testを追加し、関連9件通過。client typecheck通過。土煙・発射反動/VFX・大破演出は引き続き未接続部分を照合する。
- 同じ1時間soak session72311は1451秒まで進行。完走判定は保留。

### 発射時刻に同期する反動

- 素材ガレージの180ms sin pulseをshared shotRecoilとして接続。砲身最大3 artpx、車体最大2 artpx後退。搭乗者/キャノピーは車体に追従し、履帯は固定。同時発射は最大値、連射は各launch時刻から計算する。
- 練習は既存launchAt、オンラインはauthoritative launchTickをreplay時間へ変換して同じ反動を使用。途中観測でも経過時刻から姿勢を決める。撃破/reduced-motionは反動を止める。
- client全193件・typecheck通過後、オンライン連射時計testを追加して関連6件とe2e typecheck通過。実Pixi姿勢testで砲身/車体移動と履帯不変、通常位置復帰を追加。0/-0の復帰比較を検出し停止位置を0に統一。
- 砲口VFX、大破/煙/土煙はこの変更には含まない。次工程で素材と発生位置を照合する。
- 実Pixi反動/残骸姿勢browser test再実行通過。1時間soak session72311は1605秒まで進行を確認。

### 採掘弾の着弾素材を最新指定へ修正

- design/15の「採掘弾の着弾演出を通常爆発に統一」とruntime impactSpritesが不一致だった。diggerをcannonと同じexplosion clipへ変更し、練習・オンライン共通で適用。
- 読み込むimpact画像を使用中のexplosion/energy/drillへ限定。元のdig素材と記録は保存し、不要なダウンロードを止める。
- 実ブラウザで全4フレームがcannonと同一Textureを使うこと、drill/laserは別素材であることを変更前に失敗確認してから修正。
- 砲口接続の調査：effect-muzzleは25/35/40/40msの4枚、energyは先頭フレームを140msでfade。weapon emissionPortsは通常[144,96]、tripleはy89/96/103、multipleはy86/96/105。原点[96,96]から反動を差し引いて砲台へ接続する。runtimeへのmuzzle追加と描画接続は次工程。
- 検証：impact-art browser test、client/e2e typecheck通過。1時間soak session72311は1812秒まで進行（未完走）。

### 砲口VFXを練習・オンラインへ接続

- baseline-v2のeffect-muzzleを原寸/同一byteでruntimeへ追加（24files、human approval pending維持）。通常弾は25/35/40/40ms、laser/floaterはenergy先頭frameを140msでfadeする。
- shotFlashesを既存のlaunchAt/authoritative launchTickから算出。各砲口のemissionPortsと原点を使い、砲台回転・反動・車体移動に追従。表示Spriteを再利用し、毎poseで不要表示を消す。reduced-motionと撃破時は発光を省く。
- NetworkFieldはpose更新前に公開済みshotの武器を設定し、発射直後の1frameで前武器の砲口を使わない。
- 検証：client全197件、client/e2e typecheck、実Pixiの連装3砲口/反動追従/消去test、runtime24files同一性通過。元素材の人間承認や全画面美観の承認を代替しない。
- 次は大破遷移・残骸グレースケール・煙/着地土煙を接続。1時間soak session72311は1969秒まで進行、未完走。

### 大破から残骸への姿勢とグレースケール

- 生存→HP0を観測したときだけbaseline-v2 pilot 7/13/14を120/330/150ms再生し、600msで15（残骸）へ遷移する。初期状態ですでにHP0なら大破を再発火しない。再戦でHPが戻ると次の撃破を新しく受け付ける。
- 残骸へ移った時点で車体の8 artpx沈み込み・砲身18度下降・機体全体のdesaturateを適用。背景/名前plate/チーム色はfilter対象外。通常状態でfilter解除、描画器破棄時にfilterも破棄。毎frameでfilter配列を作り直さない。
- reduced-motionは大破モーションを省き残骸へ直行。位置・当たり判定・HP確定は変更しない。
- 検証：大破境界/途中参加/繰り返し防止/再戦のunitを先に失敗確認、client全198件とclient/e2e typecheck通過。大破→残骸の時間経過とfilterの有無を実Pixi browser testでも確認。
- ここでは大破の搭乗者姿勢と残骸表示を接続。爆発3連・損傷煙・着地土煙のSpriteは次工程。1時間soakはsession72311で2073秒まで進行、未完走。
