# baseline-v2: 配信用画像の元素材

本番のクライアントが使う着弾効果3枚（`effect-explosion`、`effect-energy`、`effect-drill`）と砲弾8枚（`projectile-*`）の元素材。
各画像を、32色 indexed PNG と編集可能な OpenRaster（`.ora`）の組で置く。

2026-09-09 に GPT Image 2.5（`gpt-image-2.5-sunburst`）の生成から作った制作パックの一部である。
機体、パイロット、武器などの残りの素材と、生成条件、書き出しと検査のツールは、2026-09-26 に削除した（設計書 0章）。
削除したものは git の履歴に残る。

PNG を変えたら、`node scripts/assets/runtime-tanks.mjs --write` で `assets/runtime/tanks-v1` へ書き出し、`pnpm assets:check` で一致を確かめる。
