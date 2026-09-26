# 配信用の砲弾と着弾効果

ゲームが使う砲弾8枚と着弾効果3枚を、`assets/workbench/baseline-v2` から無加工でコピーした配信用集合。

- `node scripts/assets/runtime-tanks.mjs --write` で再作成。
- `pnpm assets:check` で全画像のバイト一致、SHA-256、サイズと manifest を検証。
- ゲーム側は nearest sampling を維持。
- `visualApproval: pending`。人による最終アート承認を意味しない。
