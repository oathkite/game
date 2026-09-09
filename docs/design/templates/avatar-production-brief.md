# アバター制作シート

このシートはコピーして記入する。空欄のまま量産せず、未決定事項は明記する。
仕様の正本：[17章](../17-avatar-customization.md)。実行中のmanifestではない。

## 識別

- 種別：species / skin / accessory / preset
- ID：
- 所属species ID：
- 利用区分：public / owner-only
- 本人専用の原画・装備と区別する特徴：
- skin IDまたはslot：
- asset ID：
- 状態：候補 / 制作中 / 自動検査済み / 目視承認済み
- 承認対象ファイルのdigest：

## デザイン

- 元資料と参照する特徴：
- 輪郭で見分ける特徴：
- 自然の目・口の位置：
- 腹・模様など顔ではない領域：
- 通常の配色：
- body / markingの範囲と許可paint ID：
- 固定色・禁止変更箇所：
- 禁止事項（例：腹へ目を描く、メガネが浮く）：
- 対応skin、blockedSlots：

## 素材と接続

- frameSize：192×160 artpx
- artPixelsPerCell：12
- pilotSeat：[55,97]
- 方向：右向き、左右反転で使用
- headAnchor / neckAnchorまたはattach：manifestの実座標を記入
- frameFaceAreas：全使用フレームを記入
- 原画と縮尺：
- PNG / ORA / manifestの保存先：
- 生成model：gpt-image-2.5-sunburst
- プロンプト・参照画像・SHA256の保存先：

## 状態別の確認

|状態|使用フレーム・duration|顔・装備・搭乗位置|結果|
|---|---|---|---|
|idle||||
|move||||
|fire（のけぞりなし）||||
|hit||||
|low-hp||||
|fall||||
|land||||
|destroy||||
|wreck（無彩色・沈下）||||

## 受け入れ記録

- 実行した種族・スキン・装備・色の組み合わせ：
- 全武器・左右・角度・反動の検査結果：
- メガネ／首元パーツの接触、自然の目の保護：
- 固定キャノピー内の余白、腰の隠れ方：
- コンタクトシート：
- 自動検査report：
- 目視レビューと修正点：
- 未検証範囲：
