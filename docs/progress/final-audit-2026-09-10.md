# KEROPOD 最終照合（継続中）

正本はdesign/20〜23とユーザーの最新指示。実装済みを世界公開済みと読み替えない。
本番公開・main統合は別指示。以下は未完項目を解消するための作業表。

| 要件 | 現在の証拠 | 判定・次の作業 |
| --- | --- | --- |
| cold start操作可能p95 | startup-tests、10Mbps/150ms・cache無効20回、p95 684.1ms | Chromiumローカル配信で3秒条件通過。画像完了・実機CPU・実地域DNS/TLSは別 |
| 初期タイトル転送2MB | 音源圧縮後のproduction-tests/entry.spec.ts、3browserのcold新context、最大1,862,785B | ローカル配信buildで通過。実地域の起動時間とは別 |
| 初回対戦まで8MB | 音源追加で11,990,930Bに回帰したためOpus配信を追加。修正後の3browser練習地形v4・初回案内反映後の最大7,833,653B。音源追加・HUD修正後の独立8context対戦も3browserで最大7,682,043B | 圧縮音源対応3browserのローカル配信buildで通過。非対応時はMP3/WAVへ戻るため転送量が増える。実機・実地域は別 |
| 独立8クライアントで試合完走 | eight-players.spec.ts、独立8 contextで4v4入室→準備→射撃共有→青4名降参→全員同じ成績→8名帰還選択→部屋復帰 | Chromium/Firefox/WebKit配信build・local edgeで通過。射撃のみの決着は下行で追加確認。実機の証拠とは別 |
| 射撃だけで8browser完走 | natural-match.config.ts、3browser各8contextの4v4。23/24/24発で勝利、毎turnの受信state一致、全員帰還。履歴をevidence/natural-matchへ保存 | moss-valley・既定2武器・各1シナリオで確認。操作は通常WS発射コマンドを試験用に自動送信。人間の操作/公平感・全条件の証明とは別 |
| 1時間soak | Node100部屋/800接続・送受信各125ms・実ファイル保存、3600秒完走。再戦3500回/移動187021回 | ローカル試験通過。部屋分離・重複拒否・復帰・保存復元を検証。実DO容量・全client描画一致の保証とは別 |
| 代表編成の実ブラウザE2E（22.8） | 4v4は3browser検証済み。formations.spec.tsで1v7、8人FFA、2v2v2、1v1v1v2を追加し、開発版Chromium4件、配信buildのChromium/Firefox/WebKitで各4件成功（WebKitは1件と残り3件の分割実行） | 代表編成の入室→チーム設定→1発の射撃共有→降参による決着→成績/勝敗一致→全員帰還を確認。人間のバランス評価は別 |
| 開始前の人数差明示（22.1） | チーム色別の現在人数と未配置を表示し、非対称時に人数差ありを明示 | 独立3contextの1対2→FFA→退出を3browserで確認。補正・開始条件は変更しない。evidence/ui/2026-09-11-team-counts.md |
| 公開部屋一覧 | custom部屋を20件ずつ取得し、一覧参加・対戦中観戦・満員・取得失敗に対応 | local edge21部屋と3browserの独立3contextで確認。evidence/ui/2026-09-11-public-rooms.md |
| Directory分割（23.3） | 地域×mode×固定shard 0の9区分へ割当・要約更新を分離。コード発行元は共通 | local edgeとSQLite保存先・再起動復元を確認。共通発行元の容量・既存環境の移行検証は残る。evidence/ui/2026-09-11-directory-partitions.md |
| 復元失敗の隔離（23.5） | 復元拒否を永続隔離し、元snapshotを保持・無効記録・一覧除外・専用理由を通知 | local SQLiteに未対応versionを注入した再起動と、配信3browserの理由表示・resume情報消去・ロビー帰還を確認。evidence/ui/2026-09-11-room-quarantine.md |
| 地形checkpointと短いevent log（23.5） | snapshotはmaskを除き、固定surfaceと全TerrainOpから復元する。状態更新ごとにsnapshotを保存 | checkpoint maskと以後の短いop列への圧縮は未実装。書込量・復元時間の測定から間隔を決める |
| 期限付き招待token（23.7） | 招待URLは6桁roomコードを含み、権限は別sessionで検証 | 十分なentropy・期限付きdeep-link tokenは未実装。コード直参加との共存と失効を設計する |
| 全編成・射程・復元 | engine/map/server tests、進捗記録参照 | 自動検証済み。人間による公平感・バランス観察とは別 |
| ブラウザーの戻る（21.7） | メニューの親画面遷移、対戦中の退出確認、入力取消、招待直入室と待機部屋のroom.leaveを接続 | 配信buildの通常/練習/履歴再読込9件、開発版の独立2contextオンライン6件を3browserで確認。履歴は1件の同一documentガード。詳細はevidence/ui/2026-09-11-browser-back.md |
| 設定中の進行表示（21.4） | 練習/オンライン設定に進行中の表示と残り時間、自分の手番通知を共通化。スクロール中も固定表示 | オンライン2contextで減秒→射撃中の空表示→次手番通知を3browser確認。配信buildの667×375練習設定も3browser成功。確認中もサーバー時刻を使い進行 |
| 初回練習の短い案内（20.3） | 出発の準備に風→角度→長押し発射の折りたたみ案内。省略・再表示・日英・入力方式に対応 | ゲーム画面には常設せず、そのまま練習へ進める。画面サイズ別・保存拒否をproduction-tests/practice-guide.spec.tsで検証。詳細はevidence/ui/2026-09-11-practice-guide.md |
| 世界UI最終原案一致 | 浮島背景・岩盤/厚い草地・濃紺パネル・残り時間リング・円形角度計・100分割/指針・実弾アイコンを実装 | 横長岩壁、共通カメラ/タッチ配色、画面端の名前/HP補正を追加。地形表層や情報密度も含めて最終比較を継続。8人HUDの番号/HP重複を修正し3browserの対戦・帰還と小画面配置を検証。人間の最終承認は未記録 |
| 全参加者の結果表現 | 共通ResultPlayers、勝利/敗北/引き分けの表情。8context全画面の勝敗共有、667px4列/2段、390px縦向き帰還を3browserで確認 | 表情・操作の自動検証済み。最終デザイン承認は別 |
| クライアント/ゲーム内のパイロット整合 | HUD/結果の緑肌・オリーブ服に合わせた搭乗用SVG16コマをゲーム内/ロビーへ接続。二値alpha・共通足元・大破/復帰を検証。公開buildで3browserの再入場/GPU転送/実画像を確認 | 色/服の不一致を修正。簡略化した横向きの顔とHUDの最終見た目比較・承認は未完 |
| 統合テスト | 9189169でpnpm test成功（client235件、server75件、edge専用3件skip）、全対象typecheck成功。配信buildのChromium/Firefox/WebKit各24件、計72件成功 | 起動・音・戻る操作・案内・設定中timer・翻訳・pilot再入場を統合検証。実機/実地域/実DO容量の代用にしない |
| BGM・効果音 | Sunoの全20候補を取得・デコード検証。暫定10音源を加工しBGMシーン切替・効果音を組み込み。音声E2EはChromium/Firefox/WebKitで成功 | ユーザーが音楽の方向性を確認。全効果音・ループ接続の最終評価は別。Opus配信と互換fallbackを追加。加工条件・検証はevidence/suno/2026-09-11.md |
| 正式art pack | runtime manifest/hash/fidelity check | 原素材の人間承認を自動記録しない。正式pack登録条件を残す |
| 実機・browser対応 | Chromium/Firefox/WebKit配信全36件と各8接続オンライン対戦（取得失敗の繰返し復帰を含む） | 自動試験通過。実iOS/Android/Safari/Edgeの入室〜結果は別途必要 |
| mobile描画・入力・移動・復帰p95 | 機能E2E、ローカル遅延試験 | 型番/OS固定の実機SLO・地域測定は未完 |
| 入室前の地域・room RTT（23.3） | 接続先Roomへの入室前HTTP往復測定と300ms超表示を追加。対戦中はroom.ping | local edgeの席を使わないprobeと配信3browserを確認。地域別Directoryの実測中央値による自動選択も追加し、手動優先・全失敗を配信6件で確認。実地域でDirectoryとRoomのRTT差を評価する必要がある。evidence/ui/2026-09-11-region-selection.md |
| DO容量・費用 | local Wrangler復元、Node100部屋 | 実DO容量を証明しない。stage構成・費用予算・alarm・測定が必要 |
| 運用・法務・公開 | 通報保存/期限/診断/rate limit実装 | 運営主体・保持目的/削除窓口・対象地域/年齢・規約/privacy・監視担当の判断が必要 |

チームはユーザーの最新指定どおり色で表現する。旧設計の図形追加を未完要件として復活させない。
購入・rank・自由文チャットを今回の完成条件に追加しない。公開前ゲート候補と実装機能は区別する。

2026-09-11追記: 過去の統合テスト総数813件は内訳との整合を確認できないため撤回し、上表は実行結果とclient件数で記載する。276a091で草の均一な縁を斑状の房へ調整。地形alpha・比率・区画境界更新のブラウザ3件とclient/e2e型チェック成功。原案全体への一致を証明するものではない。

2026-09-11地形追記: 内蔵画像生成の岩盤v4を反映。原本はworkbenchに保持し、runtimeのRGBA一致・破壊mask・区画更新・3browserの配信量を検証。詳細はevidence/ui/2026-09-11-terrain.md。完全なseamlessや最終原案一致を証明するものではない。

2026-09-11統合検証: d8aeea1の音源・HUD・岩盤v4・パイロット調整を含む現状態で全体テストと配信39件を再実行。タイトル最大1,860,774B、初回練習最大7,831,097B。最新の8人対戦3browser検証は8c2b722時点（岩盤v4と顔調整より前）。テストの対象時点を混同しない。

2026-09-11 edge検証: 7d11de0で通常実行時にskipされるedge専用2件を、独立したlocal Wrangler/SQLite保存先にEDGE_TEST_URLを指定して実行し両方成功。同時quick割当・mode/region分離・4人自動開始、観戦のread-only制限、再接続・重複射撃拒否・次turnを確認。verify-edge-restart.tsも成功し、replaying中のSIGKILL後に同じmatch/terrain・generation 2・重複拒否を確認した。実Cloudflare配備や地域間遅延・容量の検証ではない。検証用8798/8797のプロセスは終了。

2026-09-11音源境界追記: 配信音源の端点差を測定し、result.opusで近傍の通常差より大きな段差を確認。BGMデコード後の両端2msフェードを追加。音声unit 12件、production音声3browser成功。実AudioBufferの全4曲・左右chの端点ゼロを確認。evidence/suno/loop-reviewに測定値と境界試聴用の前後比較を保存。音楽的なループ接続の聴感評価は未完。

2026-09-11統合検証更新: 8dd217bで全体テスト・全対象typecheck・配信63件を完走。通常実行ではedge専用2件はskip（local edgeの別実行結果は上記記録）。CI validateも同一headで成功。正式art pack未登録の通知は残り、アートの最終承認・実機/実地域/運用判断を完了扱いにしない。

2026-09-11待ち列修正: quick参加が旧公開listの先頭100件に依存し、それより古い空席を見落とす経路を修正。地域・mode・waiting・期限・参加者と予約席の合計をSQLで条件指定し、候補1件だけを返す。実SQLiteの101新規部屋＋古い空席・満員・期限切れ・対戦中・予約追加の回帰テストを追加（修正前失敗→修正後成功）。server型チェック成功。local Wranglerのedge専用3件も成功し、同時quick割当・開始・再接続・公開ページングを確認。Directory分割と永続outboxは引き続き未実装。

2026-09-11 outbox追記: Roomのsnapshotと最新の一覧用要約を同じSQLite transactionで保存し、外部送信前に再試行alarmを保存する永続outboxを追加。古いackは新しい要約を削除しない。SQLite unitとlocal edge3件・server両対象型チェック成功。詳細と検証限界はevidence/ui/2026-09-11-directory-outbox.md。上記の永続outbox未実装の記録を更新するが、障害注入によるprocess再起動復元は未確認。

2026-09-11 outbox障害検証: verify-directory-outbox.tsでDirectory.update例外→公開未掲載→Wrangler process groupのSIGKILL→同じSQLiteで再起動→部屋への操作なしにalarmで一覧反映→同じtokenでgeneration 2復帰が成功。上記process再起動復元の未確認をlocal workerdの範囲で解消。実Cloudflare障害・容量・地域分割とは区別する。

2026-09-11公開一覧統合検証: c4b9e35の配信build＋分割後local edgeで、一覧参加→対戦開始→一覧観戦を独立3context、Chromium/Firefox/WebKitの3件で確認（26.3秒）。同じheadのCI validate成功（run34587630846）。PR25の説明を現実装と対象時点別の検証結果に更新。

2026-09-11統合検証更新: 9189169で全体テスト（protocol24、sim107、maps68、engine141、server75＋edge専用3skip、client235）と全対象typecheck成功。配信72件は2.9分で完走し、追加した公開一覧・地域自動選択と既存の起動/音/戻る操作/練習/設定を3browserで確認。初期タイトル最大1,862,785B、初回練習まで最大7,833,653B。同一headのCI validate成功（run34588450667）。正式art pack未登録の通知は残る。新たに復元失敗隔離・地形checkpoint/短いlog・期限付きdeep-link tokenの不足を正本23章との照合で記録し、正常系の成功で完了扱いしない。
