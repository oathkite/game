# baseline-v2: 新デザインの実装用アセット

GPT Image 2.5 (`gpt-image-2.5-sunburst`) の新規生成を、共通座標の PNG と編集可能な OpenRaster に変換した制作パック。2026-09-09、29アセット・74フレーム。ゲーム組み込みと人による最終ピクセル承認は未実施。

- 共通192×160 art px、12 art px/cell、32色 indexed PNG。左右は側面画像の反転。
- 本体4層、履帯4コマ、カエル16ポーズ、独立メガネ・スカーフ、8武器、8砲弾、8種類×4コマのVFX。
- ground [96,144]、weaponPivot [96,96]、muzzle [144,96]。頭・首はポーズ別に登録。
- 車体・砲身・キャノピー枠の黄色とベージュ（ハイライト・影を含む）が primary、テラコッタのアクセントが secondary。キャラクター、装備、金属、ガラスは固定色。
- ガラスは alpha 72/255、反射は192/255。生成した枠の水平輪郭で透明マスクを掛け、枠外の光を除く。その他は0/255。
- 本体フレーム0=座席と操作部、1=車体前面、2=ガラス、3=枠。車体前面と枠でパイロットを適切に隠す。

## 再出力と検証

```sh
# sharp が通常解決できない場合は、既存の sharp パッケージ絶対パスを環境変数に指定
ASSET_SHARP_PATH=/path/to/sharp pnpm assets:export:v2
pnpm assets:validate assets/workbench/baseline-v2
pnpm assets:test
pnpm assets:lab
pnpm assets:test:browser
pnpm assets:capture
```

`prompts/` と `generation.json` に生成条件・参照・ハッシュを保存する。`generated/` は出力元と不採用の試行を保持する。使用したソースは usedByPack で区別する。元画像を変更したらエクスポートし直す。PNGだけの差し替えで検査を省略しない。

切り出し・倍率・配置は [import-baseline-v2.mjs](../../../scripts/assets/import-baseline-v2.mjs)、機械変換は [production-export.mjs](../../../scripts/assets/production-export.mjs)。規約は [16章](../../../docs/design/16-production-baseline-v2.md)。再生成も指定モデルと元のプロンプトを使い、APIキーはローカル環境にだけ渡す。

検査画像とJSONは [asset-lab-v2](../../previews/asset-lab-v2/)。41項目と368描画に加え、全武器・仰角・反動の目の重なりを確認する。人間の承認を自動記録しない。

[改善と検証の記録](quality-review.json) に最終確認の条件と残る範囲を記載。ゲーム内の最小表示と実際の物理イベント同期は、対戦画面の統合時に確認する。
