# 18. プロフィール・リザルト用キャラクター

2026-09-09改訂。**パーツ分割を廃止し、装い込みの一体スプライトを制作する。**
黄色いカエル・青いメガネ・オレンジスカーフの一式は本人専用。利用区分は[17章](17-avatar-customization.md)。

## 制作する画像

|ID|現在の画像|今後|
|---|---|---|
|neutral|3D原画の角度を保った呼吸・まばたき4コマ|待機loop|
|happy|腕を上げて喜ぶ4コマ|喜びloop|
|sad|伏し目・肩を落とすため息4コマ|悲しみloop|

今回は3状態×4コマのループ。顔アイコン・挨拶・搭乗用一体スプライトは未制作。各状態間の専用導入アニメーションは未制作で、工房の切り替えは先頭コマへ直接切り替わる。
プロフィール・勝敗画面は制作確認用のモックであり、実ゲームのアカウント・戦績との連携は未実装。

## 画像規格

- GPT Image 2.5（gpt-image-2.5-sunburst）で、衣装とキャラクターを一度に描く。
- 再送された3D原画kita.pngを唯一のキャラクター参照にする。長い白い喉・横寄りの自然の目・細い腕・メガネと小さい結び目を保つ。以前の汎用的なカエル案へ戻さない。
- 白い喉・腹は体の模様。目・顔として扱わない。
- メガネは頭に接し、スカーフは首を巻く。生成原画の段階で浮き・貫通を直す。
- 元デザイン案に近い密度。搭乗用のドット数へ固定しない。
- frameSize=192×224 artpx、foot=[96,208]。
- character.pngは2304×224、横12コマ。neutral=0〜3、happy=4〜7、sad=8〜11。
- 32色indexed PNG。透明index0、その他は不透明。character.oraを併納。
- 同一原画縮尺0.40で切り出す。悲しみの低い頭に合わせてポーズ単位で拡大しない。
- nearest・整数倍率で表示。生成原画を縮小して出力し、低解像度版を拡大して作らない。

## 納品データ

avatar.jsonはavatarPortraitVersion=2、composition=integrated。
layersはcharacterの1件のみ。これは画像読み込み形式の名称であり、着脱パーツの定義ではない。
posesにはid・label・代表frame・clip（frames / durations / loop）、metrics.characterには原画領域・縮尺・出力位置・SHA256を記録する。
availability=owner-only、grantKey=kita-personal。animationStatus=animated-loop-clips、humanReview=pending。

生成原画はgenerated/{idle,happy,sad}-animation.png、プロンプトはprompts/{idle,happy,sad}-animation.txt。参照はgenerated/kita-reference.png。
generation.jsonへmodel・参照・SHA256を記録する。過去の分離原画は制作履歴としてのみ保存し、現行出力へ使わない。
registration.jsonは一体画像のcropと足元だけを登録する。頭・首のパーツ接続点は不要。

## 工房と検証

アバター工房： http://127.0.0.1:4178/avatar.html

- 待機・喜び・悲しみを切り替え、実画像の4コマを再生する。一時停止・コマ送りに対応する。
- 背景色、足元ガイド、プロフィール・勝敗モックで見え方を確認する。
- パーツの着脱・9slot・種族間fit・装備組み合わせ検査は実装しない。
- 自動検査は本人用区分・一体画像・3ポーズ・共通縮尺・接地・切れ・PNG/ORA・原画digest。
- 12コマの描画差、3状態それぞれの全コマ進行とloop、切り替え後の再生、停止・コマ送り、レポート保存・モバイル表示をブラウザで検証する。prefers-reduced-motionでは停止して開始する。
- メガネやスカーフの自然な装着、目の読みやすさ、本人らしさは原画と出力を目視する。一体画像の自動検査で意味的な装着を保証しない。

コマンドはassets:export:avatar、assets:validate:avatar、assets:capture:avatar、assets:test、assets:test:browser。
待機の各コマ時間は1100/240/100/240ms、喜びは280/200/380/260ms、悲しみは600/300/360/340ms。最終コマから先頭へ戻る。時間判定は共通のportraitFrameで行い、状態切り替え時は経過時間を0に戻す。
パレットは全12コマ共通32色。黄色がオレンジへ崩れないよう専用の黄系・白系を含める。原画から同じ縮尺で再出力し、足裏を共通基準へ登録する。
