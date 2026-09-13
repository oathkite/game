# KEROPOD 夜間作業レポート

## 継続条件

ユーザー依頼：残りを順番にできるだけ進める。利用制限到達時のリセットは最大2枚。
継続確認：30分間隔の同一タスクheartbeat `keropod` を登録。終了条件を満たしたら停止する。

使用済みリセット：**0 / 2**。開始時のaccount使用率53%、05:55確認61%。利用上限に達する前にリセットしない。
リセット実行時はこの文書へ日時・結果・idempotencyKeyを追記し、同じ試行の再送には同じkeyを使う。
2枚使用後に次の上限へ達したら作業を止め、完了・未完了・検証・判断事項を報告する。

## 作業場所

- カメラと発射位置修正：`/Users/takehitokita/.codex/worktrees/319f/game`、`codex/2d-camera-hud-prototype`
- 多人数ルール・ネットワーク：`/Users/takehitokita/.codex/worktrees/319f/game-multiplayer`、`codex/2d-multiplayer-rules`
- ドット絵世界・共通UI：`/Users/takehitokita/.codex/worktrees/319f/game-world-ui`、`codex/2d-world-ui`

PRの統合先はcodex/2d-update。本番mainへの反映は依頼されていない。

## 完了

- 穴へ移動後の発射時のジャンプ：再生初期化が古いX/Yへ戻り、さらに古いYを使っていた。
  初回からshot.inputの確定X/Yを使用。両席の回帰2テスト、client160テスト、cameraブラウザ11テスト成功。
  カメラ側コミット：a6f59d5。多人数側にも同じ修正を適用。
- 既存の多人数移動同期基盤は337fb69までpush済み。8WebSocket・2ブラウザで検証。

## 進行中

- 射撃のseq検証・重複排除、サーバー期限での手番進行・結果・再戦を実装。engine95、server43テスト、2ブラウザE2E成功。
  続いて弾の移動→着弾時の地形更新→落下補間、60秒復帰期限と同時脱落を追加。正式ロビーは未接続。
- GPT Image 2.5（gpt-image-2.5-sunburst）で背景、破壊地形、共通panel/buttonを生成。
  既存ローカルAPI設定とbundled imagegen CLIを利用。秘密情報は保存しない。
- マップ3層、共通ボタン/panel/meter、開始/ロビー/設定/プラクティス/リザルト、全シーン演出を実装。
  world-uiのde87746（UI）と72614ce（初期カメラ値）をpush済み、draft PR https://github.com/oathkite/game/pull/25 （base codex/2d-update）。
  1440×900、844×390、667×375、390×844、worldブラウザ5テスト、client161、typecheck/build成功。
  元PNGは約15MB。背景とボタンを生成後にレビューし各v2へ改善。生成モデルは実際にgpt-image-2.5-sunburst。
  プレビュー http://127.0.0.1:5186/?prototype=world 、サーバー起動中。

## 判断が必要な事項（後で確認）

- 生成した湿地の観測所・銅色機械の世界観とドット密度の最終承認。
- UIは日本語を画像へ焼き込まず、ドット系の実テキストとして重ねる方針。翻訳・入力・可読性を維持する。
- 8人の待ち時間、非対称戦、味方ダメージ、公開マップの射程バランスは実プレイ評価が必要。
- 最終的な全シーン統合・招待alpha・本番公開の時期。

## 次の継続で優先すること

1. room gatewayと新UIの接続は完了。次は照準の逐次同期、風とマップ選択、公開用map/永続化。固定8席labとメモリ内roomを公開完成版とは表示しない。
2. match.setupへruleSetVersionと各人のloadoutを固定し、操作中の照準を同期する。impact tick再生と射撃時の角度/武器はworld-ui側で接続済み。
3. 予測補正、永続化、正式再接続/切断脱落、全マップ編成・最大逆風での到達性。
4. 生成素材の配信用最適化とproduction pack登録。実機、低速回線、負荷試験、多地域配備、通報運用。
5. ユーザーの視覚承認と招待alpha評価後、別の明示指示で公開。

## 最新の統合チェックポイント

- multiplayer 3bfa680までpush済み。draft PR26。v2の複数弾道同時tick解決が完成。
  sim107、client140、engine96、server45、Node/Chromiumの全8武器一致と移動同期E2E2件成功。旧v1 golden25を維持。
- world-uiへmultiplayerをmergeし、開始/ロビーからオンラインへ接続。カメラ/8機タンク/生成背景/破壊地形/全体図を統合。
  UI側client164、world E2E5、world-network E2E1、camera E2E11、workspace typecheck/build成功。
  PC1440×900とmobile844×390で移動・射撃・手番・カメラを確認。生成素材はDEV限定でproduction出力に入らない。
- PR25とPR26はいずれもdraft、baseはcodex/2d-update。レビュー順はPR26→PR25。main/統合branchへは未merge。
- 起動元はgame-world-ui。server8794とclient5186を使う。最新コードのserverはOrigin5186も許可。
- リセット使用は引き続き0/2。heartbeat keropodで30分ごとに同じタスクを継続する。

world-uiの生成素材は候補であり、採用最終判断は本人へ。作業を止める条件ではなく機能実装と検証は続けられる。
公開deployはしない。リセットは実際の利用制限到達時だけ最大2枚。まだ0枚。

継続確認05:31：heartbeat keropodはACTIVE、30分間隔。リセット使用0/2。両PRはdraftでbaseはcodex/2d-update。本番未反映。

05:39追加：同時tick物理の共通飛行計算を整理。元v1の計算結果は変えていない。扇は同時、volley11tick、stage hold4tickをv2初期値とした。

05:59追加：world-ui上で時刻付き弾道・launch/end tick・impact tick/damageを送信する形式へ更新。
再生は連射の発射順、着弾順のHP/地形、最終300msの落下を区別し、射撃時の角度・向き・武器を描画へ適用。
client165/server45、型チェック、2ブラウザworld-network E2E成功。labの固定loadout自体は未変更。
**新しいprotocolはworld-ui側が最新。8794 serverと5185/5186 clientはgame-world-uiから起動すること。**
PR25への前回保存は5cdea20。PR26は656c5a3。最新のtick再生commitはworld-uiのgit logで確認。

06:37追加：world-ui上で正式ロビー準備のengine状態処理を実装。全58編成、2〜8人、未配置、ready/revision、権限、owner移譲、装備固定を検証。
PreparedMatch→BattleSessionへloadoutとruleSetVersionを渡し、選択したtripleで3弾道になることを確認。
engine104/server45/protocol22、workspace typecheck成功。詳細docs/design/28-lobby-preparation.md。
**次はWebSocketでの部屋分離と新UIの部屋操作。今回のロビー基盤はまだ画面/通信へ接続していない。**
最新作業はgame-world-uiにあり、lab replay packetはshot.weaponを使う。リセット0/2。本番未反映。

07:08追加（起床後の継続）：DEV room gateway8795と新UIを接続。作成/6桁code参加/チーム/装備/ready/対戦/結果/準備復帰を実装。
複数部屋の状態・配信分離、権限、60秒token復帰、owner退出後の権限移譲を実WebSocketで検証。
PC+mobileの2ブラウザ縦断、装備変更のready解除、667×375主要操作44pxを確認。world5/fixed-network1も成功。
server46/client165、型チェック/build成功。設計28章に起動方法と制限を記録。serverは8794(lab)と8795(rooms)、UI5186。
リセット0/2。本番未反映。部屋はメモリ内で再起動時に消える。公開永続化とマップ/風は次工程。
