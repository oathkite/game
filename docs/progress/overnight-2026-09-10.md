# KEROPOD 夜間作業レポート

## 継続条件

ユーザー依頼：残りを順番にできるだけ進める。利用制限到達時のリセットは最大2枚。
継続確認：30分間隔の同一タスクheartbeat `keropod` を登録。終了条件を満たしたら停止する。

使用済みリセット：**0 / 2**。開始時のaccount使用率53%、05:16確認55%。利用上限に達する前にリセットしない。
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
  world-uiのde87746をpush済み、draft PR https://github.com/oathkite/game/pull/25 （base codex/2d-update）。
  1440×900、844×390、667×375、390×844、worldブラウザ5テスト、client160、typecheck/build成功。
  元PNGは約15MB。背景とボタンを生成後にレビューし各v2へ改善。生成モデルは実際にgpt-image-2.5-sunburst。
  プレビュー http://127.0.0.1:5186/?prototype=world 、サーバー起動中。

## 判断が必要な事項（後で確認）

- 生成した湿地の観測所・銅色機械の世界観とドット密度の最終承認。
- UIは日本語を画像へ焼き込まず、ドット系の実テキストとして重ねる方針。翻訳・入力・可読性を維持する。
- 8人の待ち時間、非対称戦、味方ダメージ、公開マップの射程バランスは実プレイ評価が必要。
- 最終的な全シーン統合・招待alpha・本番公開の時期。

## 残タスク

1. 射撃→結果→再戦の縦断実装と多人数テスト。
2. マップ3層、共通UI部品と各画面を画像生成・レビュー・修正して試作へ接続。
3. protocol v2の正式ロビー、予測補正、完全な再接続/切断脱落、永続化。
4. 複数弾道の同一tick解決、全マップ編成・最大逆風での到達性。
5. カメラ/実タンクアート/オンライン対戦の統合。開始ページと全シーン演出。
6. 実機、低速回線、負荷試験、多地域配備、通報運用。ユーザー承認後に公開。


## 次の継続で優先すること

1. multiplayer側の最新コミット・PR・preview起動を確認し、未コミットがあればまず保存する。
2. `docs/design/25-multiplayer-foundation.md`に記載した複数弾道の同一tick解決を実装する。旧v1 goldenを維持し、v2だけ新しい順序を採用する。
3. 8人オンラインとカメラ/実タンク/新UIの合流。作業branch同士をworld-ui上へ統合してよいが、統合branchやmainへのmergeはしない。
4. 正式ロビーの任意チーム編成、ready、部屋分離、loadout固定と繋ぐ。固定8席のlabを完成版とは表示しない。

world-uiの生成素材は候補であり、採用最終判断は本人へ。作業を止める条件ではなく機能実装と検証は続けられる。
公開deployはしない。リセットは実際の利用制限到達時だけ最大2枚。まだ0枚。
