# 13. アセット一覧と制作状況

2026-09-09。最新は [baseline-v2](../../assets/workbench/baseline-v2/README.md)。承認された新デザインをGPT Image 2.5で部品から再制作し、29アセット・74フレームを動作試験台へ組み込んだ。旧 baseline-v1 と旧比較画像は履歴として残すが、新規制作の参照に使わない。

## 正本と現在の成果

|資料|用途|
|---|---|
|[新しい機体・カエル](../../assets/concepts/original-v1/03-direction-refined.png)|固定本体、配色、体格|
|[8武器と砲弾](../../assets/concepts/original-v1/07-weapons-refined.png)|武器と弾の識別形状|
|[リアクション](../../assets/concepts/original-v1/05-motion-board.png)|9状態の演技|
|[演出](../../assets/concepts/original-v1/06-effects-board.png)|発生・拡張・消散|
|[全16ポーズの合成](../../assets/previews/asset-lab-v2/poses.png)|装備追従と搭乗位置|
|[武器の合成](../../assets/previews/asset-lab-v2/weapons.png)|共通本体への取り付け|
|[演出32コマ](../../assets/previews/asset-lab-v2/effects.png)|VFXの連続性|
|[検査JSON](../../assets/previews/asset-lab-v2/automatic-report.json)|現在の自動検査結果と対象範囲|

コンセプトボードを直接 atlas として切り出していない。新たな透過パーツ原画・プロンプト・参照ハッシュはパック内に保存する。カエルの解剖学だけは最初の3Dモデル画像へ戻って確認する。

## 制作・組み込み状況

|分類|新パックの内容|状態|
|---|---|---|
|固定本体|座席と操作部、車体前面、ガラス、枠の4層|形式・合成検証済み|
|足回り|静止兼移動位相0、位相1/2、大破の4コマ|形式・再生検証済み|
|カエル|16ポーズで9状態|形式・再生検証済み|
|オプション|青いメガネ、オレンジのスカーフ|独立素材。全ポーズの接続検証済み|
|武器|cannon/triple/multiple/drill/laser/digger/floater/stinger|8種を合成・全仰角検証済み|
|砲弾|8武器それぞれ固有の輪郭|8種を試射表示|
|VFX|explosion/smoke/muzzle/spark/dust/energy/drill/dig 各4コマ|消散・切り出し検証済み|
|塗装|primaryとsecondary、固定色の32色palette|試験台で2色変更可能|
|編集用データ|各素材のPNG、ORA、manifest、生成元とハッシュ|再出力可能|
|キャラクター単体の全方向|コンセプトと元写真|実装用画像は未制作|
|追加種・追加足回り|共通接続契約|個別素材は未制作|
|地形・背景・対戦HUD・ロビー・リザルト|世界観とUIの方向性|実装用画像は未制作|
|ゲーム描画への統合|物理のアンカー契約を維持|未実装|

試験台への組み込みと、ゲームへの組み込みを区別する。パックは draft。人による最終的なピクセル承認、最小対戦表示と実際の弾道・当たり判定の統合検証は別工程。

追加種には全リアクションと装備ランドマーク、追加足回りには接地と駆動ループ、追加武器には機体・砲弾・着弾表現を一組で用意する。本体を複製して変形しない。購入方式・スキン/ペイント方式は未定のため、ショップ画像を先行制作しない。
