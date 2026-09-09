# 基準素材 v1

初期カエル、固定本体、履帯、8 武器、装備、砲弾、共通 VFX の動く試作 pack。
25 asset を PNG、OpenRaster 原画、pack.json として用意した。
制作規約 v1 の形式検証対象であり、metrics と人による目視承認は未確定。
ユーザー指定により、今後は GPT Image 2.5 で全ビジュアルを再制作する。本 pack は比較と回帰検証用である。

カエルは 16 ポーズから 9 状態を構成する。
待機の瞬き、移動、反動、被弾、不安、大破時に頭をかばう姿勢、残骸の落胆を分ける。
白い喉と腹を顔として扱わず、元資料の頭上の目を維持する。
メガネとスカーフは独立 PNG で、動く頭と首へ接続する。
搭乗者は車体前面より奥へ置き、履帯は車体幅に合わせ、砲身を大きくした。
座席を含む旧本体画像は合成時に前面部分を切り出す。次の素材では背面と前面を最初から分ける。

画像は built-in imagegen で生成し、generated に生成結果、prompts に制作指示を保存する。
背景のチェック柄は imagegen の背景除去で透過へ修正した。
modules-gloss.png はモデル指定前の既存光沢原画を復元したもので、GPT Image 2.5 の新規成果物ではない。
ガラス用フレームの反射は透明度を独立指定し、PNG の tRNS に半透明 index を保持する。
import-baseline.mjs はセルの抽出、原点への配置、最近傍リサイズ、27 色への変換、PNG と OpenRaster の出力を行う。
原画はパーツごとの atlas レイヤーであり、全機体を焼き込んだ画像ではない。
2026-09-09 の再出力では縦横比と連続コマの共通倍率を保持し、全16ポーズの装備接続点と目の領域を記録した。
反動コマ6は座席への登録位置を7 art px右へ補正し、頭と装備がキャノピーからはみ出さない配置にした。
次回は [修正記録と生成指示](../../../docs/design/15-animation-feedback.md) を適用する。

## 再出力

Node.js、sharp、zip が必要。
sharp がローカルにない場合は、既存インストールの絶対パスを ASSET_SHARP_PATH に指定する。
通常の検証とガレージの起動には sharp は不要。

```sh
ASSET_SHARP_PATH=/path/to/node_modules/sharp node scripts/assets/import-baseline.mjs
pnpm assets:validate assets/workbench/baseline-v1
pnpm assets:lab
```

生成結果を再編集した場合は、出力と検査記録を更新する。
import はこの試作 pack の出力のみを再生成する。
手修正した PNG や OpenRaster を上書きしないよう、手修正後は別 pack へ分ける。

## 次の制作段階

全ポーズの装備位置と左右差分、実ゲームの最小倍率、色の最終調整、武器の完全な側面形状を目視で詰める。
現在の OpenRaster 原画からさらにドット単位で仕上げる余地がある。
8 武器の固有貫通、土砂、浮遊表現は共通 VFX での先行確認であり、最終的な固有素材の完成ではない。
承認前に assets/sprites へ移さず、review.json も作成しない。
