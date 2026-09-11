# KEROPOD 最終照合（継続中）

正本はdesign/20〜23とユーザーの最新指示。実装済みを世界公開済みと読み替えない。
本番公開・main統合は別指示。以下は未完項目を解消するための作業表。

| 要件 | 現在の証拠 | 判定・次の作業 |
| --- | --- | --- |
| cold start操作可能p95 | startup-tests、10Mbps/150ms・cache無効20回、p95 684.1ms | Chromiumローカル配信で3秒条件通過。画像完了・実機CPU・実地域DNS/TLSは別 |
| 初期タイトル転送2MB | 音源圧縮後のproduction-tests/entry.spec.ts、3browserのcold新context、最大1,860,774B | ローカル配信buildで通過。実地域の起動時間とは別 |
| 初回対戦まで8MB | 音源追加で11,990,930Bに回帰したためOpus配信を追加。修正後の3browser練習地形v4反映後の最大7,831,097B。音源追加・HUD修正後の独立8context対戦も3browserで最大7,682,043B | 圧縮音源対応3browserのローカル配信buildで通過。非対応時はMP3/WAVへ戻るため転送量が増える。実機・実地域は別 |
| 独立8クライアントで試合完走 | eight-players.spec.ts、独立8 contextで4v4入室→準備→射撃共有→青4名降参→全員同じ成績→8名帰還選択→部屋復帰 | Chromium/Firefox/WebKit配信build・local edgeで通過。射撃のみの決着は下行で追加確認。実機の証拠とは別 |
| 射撃だけで8browser完走 | natural-match.config.ts、3browser各8contextの4v4。23/24/24発で勝利、毎turnの受信state一致、全員帰還。履歴をevidence/natural-matchへ保存 | moss-valley・既定2武器・各1シナリオで確認。操作は通常WS発射コマンドを試験用に自動送信。人間の操作/公平感・全条件の証明とは別 |
| 1時間soak | Node100部屋/800接続・送受信各125ms・実ファイル保存、3600秒完走。再戦3500回/移動187021回 | ローカル試験通過。部屋分離・重複拒否・復帰・保存復元を検証。実DO容量・全client描画一致の保証とは別 |
| 代表編成の実ブラウザE2E（22.8） | 4v4は3browser検証済み。formations.spec.tsで1v7、8人FFA、2v2v2、1v1v1v2を追加し、開発版Chromium4件、配信buildのChromium/Firefox/WebKitで各4件成功（WebKitは1件と残り3件の分割実行） | 代表編成の入室→チーム設定→1発の射撃共有→降参による決着→成績/勝敗一致→全員帰還を確認。人間のバランス評価は別 |
| 全編成・射程・復元 | engine/map/server tests、進捗記録参照 | 自動検証済み。人間による公平感・バランス観察とは別 |
| ブラウザーの戻る（21.7） | メニューの親画面遷移、対戦中の退出確認、入力取消、招待直入室と待機部屋のroom.leaveを接続 | 配信buildの通常/練習/履歴再読込9件、開発版の独立2contextオンライン6件を3browserで確認。履歴は1件の同一documentガード。詳細はevidence/ui/2026-09-11-browser-back.md |
| 初回練習の短い案内（20.3） | BattleMenuにはキーボードの説明がある。WorldScenesの練習入口はCameraPrototypeへ直接遷移 | 風→角度→長押し発射の初回案内は未実装。ゲーム画面に説明を常設しない最新指示を維持し、任意の初回案内として実装する |
| 世界UI最終原案一致 | 浮島背景・岩盤/厚い草地・濃紺パネル・残り時間リング・円形角度計・100分割/指針・実弾アイコンを実装 | 横長岩壁、共通カメラ/タッチ配色、画面端の名前/HP補正を追加。地形表層や情報密度も含めて最終比較を継続。8人HUDの番号/HP重複を修正し3browserの対戦・帰還と小画面配置を検証。人間の最終承認は未記録 |
| 全参加者の結果表現 | 共通ResultPlayers、勝利/敗北/引き分けの表情。8context全画面の勝敗共有、667px4列/2段、390px縦向き帰還を3browserで確認 | 表情・操作の自動検証済み。最終デザイン承認は別 |
| クライアント/ゲーム内のパイロット整合 | HUD/結果の緑肌・オリーブ服に合わせた搭乗用SVG16コマをゲーム内/ロビーへ接続。二値alpha・共通足元・大破/復帰を検証。公開buildで3browserの再入場/GPU転送/実画像を確認 | 色/服の不一致を修正。簡略化した横向きの顔とHUDの最終見た目比較・承認は未完 |
| 統合テスト | d8aeea1でpnpm test成功（client225件、server72件、edge専用2件skip）、全対象typecheck成功。最新配信buildのChromium/Firefox/WebKit合計39件成功 | ローカルで確認。実機/実地域/実DO容量の代用にしない |
| BGM・効果音 | Sunoの全20候補を取得・デコード検証。暫定10音源を加工しBGMシーン切替・効果音を組み込み。音声E2EはChromium/Firefox/WebKitで成功 | ユーザーが音楽の方向性を確認。全効果音・ループ接続の最終評価は別。Opus配信と互換fallbackを追加。加工条件・検証はevidence/suno/2026-09-11.md |
| 正式art pack | runtime manifest/hash/fidelity check | 原素材の人間承認を自動記録しない。正式pack登録条件を残す |
| 実機・browser対応 | Chromium/Firefox/WebKit配信全36件と各8接続オンライン対戦（取得失敗の繰返し復帰を含む） | 自動試験通過。実iOS/Android/Safari/Edgeの入室〜結果は別途必要 |
| mobile描画・入力・移動・復帰p95 | 機能E2E、ローカル遅延試験 | 型番/OS固定の実機SLO・地域測定は未完 |
| DO容量・費用 | local Wrangler復元、Node100部屋 | 実DO容量を証明しない。stage構成・費用予算・alarm・測定が必要 |
| 運用・法務・公開 | 通報保存/期限/診断/rate limit実装 | 運営主体・保持目的/削除窓口・対象地域/年齢・規約/privacy・監視担当の判断が必要 |

チームはユーザーの最新指定どおり色で表現する。旧設計の図形追加を未完要件として復活させない。
購入・rank・自由文チャットを今回の完成条件に追加しない。公開前ゲート候補と実装機能は区別する。

2026-09-11追記: 過去の統合テスト総数813件は内訳との整合を確認できないため撤回し、上表は実行結果とclient件数で記載する。276a091で草の均一な縁を斑状の房へ調整。地形alpha・比率・区画境界更新のブラウザ3件とclient/e2e型チェック成功。原案全体への一致を証明するものではない。

2026-09-11地形追記: 内蔵画像生成の岩盤v4を反映。原本はworkbenchに保持し、runtimeのRGBA一致・破壊mask・区画更新・3browserの配信量を検証。詳細はevidence/ui/2026-09-11-terrain.md。完全なseamlessや最終原案一致を証明するものではない。

2026-09-11統合検証: d8aeea1の音源・HUD・岩盤v4・パイロット調整を含む現状態で全体テストと配信39件を再実行。タイトル最大1,860,774B、初回練習最大7,831,097B。最新の8人対戦3browser検証は8c2b722時点（岩盤v4と顔調整より前）。テストの対象時点を混同しない。

2026-09-11 edge検証: 7d11de0で通常実行時にskipされるedge専用2件を、独立したlocal Wrangler/SQLite保存先にEDGE_TEST_URLを指定して実行し両方成功。同時quick割当・mode/region分離・4人自動開始、観戦のread-only制限、再接続・重複射撃拒否・次turnを確認。verify-edge-restart.tsも成功し、replaying中のSIGKILL後に同じmatch/terrain・generation 2・重複拒否を確認した。実Cloudflare配備や地域間遅延・容量の検証ではない。検証用8798/8797のプロセスは終了。

2026-09-11音源境界追記: 配信音源の端点差を測定し、result.opusで近傍の通常差より大きな段差を確認。BGMデコード後の両端2msフェードを追加。音声unit 12件、production音声3browser成功。実AudioBufferの全4曲・左右chの端点ゼロを確認。evidence/suno/loop-reviewに測定値と境界試聴用の前後比較を保存。音楽的なループ接続の聴感評価は未完。
