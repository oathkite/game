# 配信用タンク画像

ゲームが使うタンク11枚と爆発1枚をbaseline-v2から無加工でコピーした配信用集合。
画像の生成元・編集データ・全アニメーション定義は制作パック側に保持する。

- `node scripts/assets/runtime-tanks.mjs --write` で再作成。
- `pnpm assets:check` で全画像のバイト一致、SHA-256、サイズとmanifestを検証。
- frameは192×160、12 art pixels/cell。ゲーム側はnearest samplingを維持。
- `visualApproval: pending`。配信用フォルダーへの分離は人による最終アート承認や全アニメーションのゲーム統合を意味しない。
