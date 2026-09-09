# KITA 本人専用の一体スプライト

メガネなしの黄色いカエル・オレンジのスカーフをGPT Image 2.5で一体生成。
再送デザイン案「FORTRESS / NEW DIRECTION 01」を参照したneutral / happy / sadの各4コマループ。96×112 artpx、足元[48,104]、純黒輪郭・16色以内、前方3/4 view。
character.png（横12コマ）とcharacter.oraを納品。着脱パーツなし。工房で体色・スカーフ色を変更可能。
本人専用。一般配布・販売・公開defaultへ使用しない。draft / humanReview pending。
原画generated/{idle,happy,sad}-slim.png、編集プロンプトprompts/slim-concept.txt、参照generated/concept-reference.png、登録registration.json、出典generation.json。
旧分離原画は履歴のみ。現行出力には使わない。
仕様：[18章](../../../docs/design/18-avatar-portraits.md)。確認： http://127.0.0.1:4178/avatar.html

喜びはバンザイジャンプ（空中高さ8/16 artpx）、悲しみは座り込む動き。各4コマ。

タンクの実rendererと同じドット倍率の比較：tank-comparison.png。

立ち絵・勝敗は空席のタンクの手前に配置し、共通の整数ドット倍率で描画。カエル単独の拡大は行わない。

造形：丸い胴体・短い手足・左右2つの目の膨らみ。旧メガネ除去版を参照として再利用しない。

スカーフ色は各コマの登録領域内のみ使用。手足への混入をexportとテストで防止する。

2026-09-09：待機・喜び・悲しみの絵をユーザーが承認。quality-review.jsonのartApprovalに対象ファイルのSHA256を記録。draft / humanReview=pendingはゲーム本体への組み込みを含む制作・リリース判定として残し、この絵の承認と区別する。
