# アバター制作シート

このシートはコピーして記入する。空欄のまま量産せず、未決定事項は明記する。
仕様の正本：[17章](../17-avatar-customization.md)、[19章](../19-avatar-form-and-parts.md)。実行中のmanifestではない。

## 識別

- 種別：species / skin / accessory / preset
- ID：
- 所属species ID：
- 利用区分：public / owner-only
- 本人専用の原画・装備と区別する特徴：
- bodyProfile（標準round-biped-v1）：
- UIカテゴリ / occupies（複数slot可）：
- conflictsWith / blockedSlots：
- skin ID：
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

- presentation：portrait / battle（両方を個別記入）
- frameSize：portrait=192×224 / battle=192×160 artpx
- artPixelsPerCell：12
- pilotSeat：[55,97]
- 方向：portrait=少し右向きの前方3/4 / battle=真横右向き
- 本人基準の左右、非対称反転フレーム：
- 部位別anchorと整数offset：全使用フレームの実座標を記入
- 素体分割、パーツ前後レイヤー、bodyHideMask：
- 目・口の保護マスク / coversFeatures：
- battle.visibility（visible / occluded）と理由：
- frameFaceAreas：全使用フレームを記入
- 原画と縮尺：
- PNG / ORA / manifestの保存先：
- 生成model：gpt-image-2.5-sunburst
- プロンプト・参照画像・SHA256の保存先：

## 状態別の確認

portraitはneutral / happy / sadを別表で記録する。未制作のアニメーションは未検証と記す。

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
- 顔・体・手・足の接続、足裏、自然の目の保護：
- 複数枠占有・競合・種族変更・装備解除の確認：
- 固定キャノピー内の余白、腰の隠れ方：
- コンタクトシート：
- 自動検査report：
- 目視レビューと修正点：
- 未検証範囲：
