# クイック参加

## 対戦条件

- 1v1（2人）、2v2（4人）を分離。customは同じ候補に入れない。
- asia / europe / americasを分離し、希望地域を勝手に切り替えない。
- 参加時に人数の少ない側へ自動配置。編成・マップ変更を拒否する。
- 装備を選び、全員が準備完了したらサーバーが自動開始。人数不足では開始しない。
- 入退出や装備変更でreadyを解除する既存規則を維持。BOTを補充しない。
- 30秒待機したら地域変更または練習への案内を出し、いつでも待機をキャンセルできる。

## 割り当て

`POST /v2/quick`は `{mode, region}` を受ける。
Directoryは同じmode/regionの待機部屋から空席を探し、10秒の接続予約を加算する。
同時に空き1席へ複数人を割り当てないよう、現在人数と予約数の合計で判定する。
Nodeも接続処理中の予約数を含めて選択し、Room reducerが最終的な定員を強制する。

新規RoomObjectの初期化をRPCで完了してから部屋番号を返す。
CloudflareのlocationHintをasia=apac/europe=weur/americas=enamへ設定する。
これは配置の希望であり、実際のRTTや世界各地からの快適性を証明するものではない。

既存RoomObjectへの接続はDirectoryを参照せずSQLiteを確認する。
Directoryの一覧更新失敗が既存の招待・再接続を妨げない。

## 入力と運用

- モード・地域はstrict schemaで検証。POST bodyは512 bytesまで読む。
- 匿名の割当APIはCF-Connecting-IPをキーとし、120回/60秒のRate Limitを適用する。
- 共有IPの利用者も同じ枠になるため、公開前の負荷・実利用計測でこの閾値を確認する。
- binding namespace_id=2026091001は、公開先アカウントで既存用途と重複しないことをリリース時に確認する。
- [Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)はlocation単位であり、厳密な課金上限には使用しない。

## 検証

- Room reducer: 4人未満の開始拒否、2:2自動配置、定員、mode/region混在拒否。
- edge-quick.test.ts: 同時4予約の同室割当、5人目/別mode/別regionの分離、全ready自動開始。
- quick.spec.ts: 1v1と2v2のブラウザー対戦開始、30秒後の案内とキャンセル。
