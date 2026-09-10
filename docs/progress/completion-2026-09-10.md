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
