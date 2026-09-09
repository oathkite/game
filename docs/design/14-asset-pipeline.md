# 14. アセット制作規約と検証

> 2026-09-09: 新デザインの正本・色・パーツ構造・制作寸法は [16. 新デザインの制作基準](16-production-baseline-v2.md) を優先する。実装用素材は baseline-v2。旧案は履歴として区別し、新規生成の参照にしない。

この章を画像制作の納品契約 v1 とする。
生成画像や見本を、そのままゲーム用スプライトとして扱わない。
形式検証と目視レビューを通した素材だけを組み込み候補へ進める。
次回生成・再出力では [15 章の修正記録](./15-animation-feedback.md) を必ず適用する。
生成 pack は productionMethod と exportMetrics を記録し、共通倍率・全コマの接続点・目の保護領域を検査する。
[baseline-v2](../../assets/workbench/baseline-v2/README.md) を制作中 pack として追加した。
29アセット・74フレームを形式・画素・動作検証済み。metrics は draft。人による最終承認とゲーム統合は未実施。

## 14.1 制作工程と保存場所

| 段階 | 保存場所 | 完了条件 |
|---|---|---|
| 参照と方向性 | assets/concepts、assets/previews | 形と方向性の確認。納品形式の対象外 |
| 制作中 | assets/workbench/<pack-id>/ | 編集用原画、PNG、pack.json を作り、構造検証を通す |
| 目視レビュー | 同じ pack 内の review.json | 実寸と合成で確認し、対象ファイルの digest を記録 |
| 組み込み候補 | assets/sprites/<pack-id>/ | metrics 承認と release 検証を通す |
| ゲーム実装 | client の描画処理 | 実寸、再生、入力、既存物理との一致を確認 |

pack は同時にレビューする素材のまとまりである。
一つの pack の合格はゲーム全素材の完成を意味しない。
全体の制作範囲は [13 章](./13-asset-preview.md) で管理する。
組み込み候補への移動だけではアプリから読み込まれず、atlas のロードと描画は別の実装工程である。

各 pack は以下を持つ。

- pack.json：形式 version、制作倍率、素材一覧、フレームと接続点。
- 素材ごとの PNG：例 pilot-frog.png、weapon-cannon.png。
- 編集用原画：.aseprite または .ora。レイヤーと色の役割を保持する。
- review.json：承認時だけ作成する目視レビュー記録。

ID とファイルのベース名は英小文字、数字、ハイフンで統一する。
ファイル参照は pack 内の相対パスにし、外部ファイルや pack 外への symlink を使わない。
元のユーザー提供画像は参照ディレクトリに保存し、名前や内容を改変しない。

## 14.2 PNG の規格

| 項目 | 契約 |
|---|---|
| 形式 | PNG、color type 3、bit depth 8 の indexed color |
| 色数 | 透明色を含め 2〜32 色。素材ごとの PLTE に役割を対応させる |
| 透過 | index 0 のみ alpha 0。通常素材は他の index が alpha 255。cabin の alphaMode: glass のみ半透明の palette index を許可。輪郭のアンチエイリアスは禁止 |
| サイズ | 1 辺 1〜4096 art px、ファイル 16 MiB 以下 |
| フレーム | 固定幅と高さの等間隔グリッド。余白込みの原点を保持 |
| packing | trim、rotation、interlace、APNG を使わない |
| 描画 | 1 art px 単位で描く。輪郭のぼかし、JPEG の再保存をしない |
| 禁止する焼き込み | 背景、説明文字、名前、HP、別パーツ、別レイヤーの VFX |

プレビュー用のラベルや台紙は別ファイルとする。
ガラスは半透明の色面と光沢で奥行きを示し、不透明な枠と別フレームにする。
ガラスの半透明 index は固定色とし、車体の tint を掛けない。目の上へ不透明な反射を置かない。
UI の文字とパネルは React/CSS を基本とし、ラベル入りのボタン画像を量産しない。
背景や UI アイコンを PNG として納品する場合も同じ indexed 規格に従う。
将来別形式が必要になった場合は、規約の version と検証器を一緒に改訂する。

## 14.3 寸法、座標、共通本体

新パックの共通フレームは192×160 art px、12 art px/cellとする。最小対戦画面の表示倍率と正式な組み込み承認はTBD-27で確認する。
基準機体で顔、オプション、砲口が最小の対戦表示でも読めることを確認してから承認する。

pack.json の artPixelsPerCell は 1 セルに対応する art px 数で、v1 は 1〜16 の整数とする。
試作中は metricsStatus を draft とし、実寸検証後に approved とする。
この値は原画と物理の換算であり、画面上の拡大倍率とは異なる。
UI だけの pack でも比較用の共通倍率を記録する。

接続点はフレーム左上を原点とし、右が +x、下が +y の整数座標で記録する。
キャンバス端の座標も接続点として許可する。
フレーム番号は左上から右へ、次に下の行へ進む 0 始まりとする。

| kind | 必須接続点 | 必須 clip |
|---|---|---|
| cabin | ground、pilotSeat、weaponPivot、damageSmoke | idle、wreck |
| undercarriage | ground、cabinMount、exhaust | idle、move、wreck |
| pilot | pilotSeat、headAnchor、neckAnchor | idle、move、fire、hit、low-hp、fall、land、destroy、wreck |
| accessory | attach | idle |
| weapon | weaponPivot、muzzle | idle、fire、wreck |
| projectile | origin | fly |
| effect | origin | play |
| ui、background | origin | idle |

共通本体の ID は cabin-standard の一つに限定する。
キャノピー、台座、座席を選択肢にせず、初回に承認した同一の原画を全組み合わせで使う。
本体の背面と前面は同一 sheet の別フレームに分け、idle-front、wreck-front などの追加 clip で前面を指定する。
baseline-v2 の idle と wreck は車体前面、idle-back は座席、idle-glass はガラス、idle-front は枠を指す。旧パックのフレーム意味を流用しない。
前面の選択やパーツの重なりを実装する際は、11.2 の順序を守る。

静止時の weaponPivot は ground の真上 4 セル、muzzle は右向きの weaponPivot から右へ 4 セルとする。
位置を変えて見栄えだけ合わせることはしない。
cabin の faceSafeArea は [x, y, width, height] で記録し、枠や武器に覆われない領域を目視で確認する。

各素材は anchors に基準座標を持つ。
頭や首が動くフレームは frameAnchors にそのフレームの差分座標を記録し、メガネとスカーフを追従させる。
座席や地面の物理原点は絵の揺れで動かさず、共通モーションの表示変位として扱う。
原点の数値範囲と砲口の静止距離は自動検証するが、新パックでは装備の頭への接触・目の非遮蔽・透過・接地・砲口を画素で検査し、輪郭と演技も目視確認する。

## 14.4 色と独立レイヤー

paletteRoles は PNG の PLTE と同じ順番、同じ要素数で記録する。
色の RGB 値から役割を推測しない。

| 役割名 | 使い方 |
|---|---|
| transparent | index 0 のみ |
| fixed | 輪郭、金属、キャノピーの枠など。任意の複数 index に使用可 |
| primary-light / mid / dark | 車体の主色の 3 段階。実際のキーは primary-light、primary-mid、primary-dark |
| secondary-light / mid / dark | 武器カバーの副色の 3 段階。同じ命名規則 |
| pilot | 種ごとの体色と色面。マシンの tint 対象外 |
| accessory | メガネやスカーフ。体と別 palette として扱う |
| owner | 砲弾や VFX に使う発射者の識別色 |
| smoke | 煙用の固定色 |

同じ役割名を複数の index に割り当てられる。
pilotの色替え領域とカタログ案は[17章](17-avatar-customization.md)に定義する。avatarPaletteに対応するvalidatorとrendererは未実装であり、現時点で汎用ペイント実装済みとは扱わない。
マシンの全 49 色組み合わせで固定色、目、装備、輪郭が保たれることを確認する。
PNG の近似色を探索する置換や、合成画像全体への tint は禁止する。

メガネとスカーフは別 asset とし、素体へ焼き込まない。
背面と前面が必要な装備はフレームを分け、attach の接続元を制作メモに明記する。
別種への対応は種ごとに素材と接続位置を制作し、既存カエルを引き伸ばさない。
装備対応表と組み合わせの互換性検証は、描画実装時に追加する。

## 14.5 manifest の記述

下記は記述用テンプレートであり、完成素材のサンプルではない。
実ファイルが存在しないまま検証に通ることはない。
frameSize と倍率は仮値である。

```json
{
  "version": 1,
  "id": "pilot-frog-draft",
  "metricsStatus": "draft",
  "artPixelsPerCell": 4,
  "assets": [
    {
      "id": "pilot-frog",
      "kind": "pilot",
      "file": "pilot-frog.png",
      "source": "pilot-frog.aseprite",
      "frameSize": [32, 32],
      "paletteRoles": ["transparent", "fixed", "pilot", "pilot"],
      "anchors": {"pilotSeat": [16, 28], "headAnchor": [16, 8], "neckAnchor": [16, 18]},
      "frameAnchors": {"1": {"headAnchor": [16, 9], "neckAnchor": [16, 19]}},
      "clips": {
        "idle": {"frames": [0, 1], "durationsMs": [1000, 200], "loop": true},
        "move": {"frames": [2], "durationsMs": [100], "loop": true},
        "fire": {"frames": [3], "durationsMs": [180], "loop": false},
        "hit": {"frames": [4], "durationsMs": [120], "loop": false},
        "low-hp": {"frames": [5], "durationsMs": [1600], "loop": true},
        "fall": {"frames": [6], "durationsMs": [100], "loop": true},
        "land": {"frames": [7], "durationsMs": [180], "loop": false},
        "destroy": {"frames": [8, 9, 10], "durationsMs": [150, 300, 150], "loop": false},
        "wreck": {"frames": [11], "durationsMs": [1000], "loop": true}
      }
    }
  ]
}
```

全フレームの duration は 1〜10000 ms の整数とし、frames と要素数を揃える。
idle、move、low-hp、fall、wreck、fly は loop とする。
静止画は同じ 1 フレームを保持する loop でよい。
fire、hit、land、destroy は一度だけ再生する。
VFX の play は用途に応じて loop を明示する。

clip の存在だけでは十分な動きや表情を保証できない。
LOW HP は不安、DESTROY は驚きと身をかばう動作、WRECK は落胆を姿勢で描き分ける。
発射、ダメージ、地形削除のタイミングは [11.5〜11.6](./11-sprite-animation.md) の既存 replay に合わせる。
manifest の duration を理由に物理イベントやサーバーの終了を遅らせない。

## 14.6 自動検証ハーネス

リポジトリに [検証器](../../scripts/assets/validate.mjs) と [PNG 検査](../../scripts/assets/png.mjs)、[テスト](../../scripts/assets/validate.test.mjs) を置く。
Node.js の標準機能だけを使い、画像編集ソフトのインストールを必要としない。

```sh
pnpm assets:test
pnpm assets:validate assets/workbench/pilot-frog-draft
pnpm assets:validate assets/workbench/pilot-frog-draft --digest
pnpm assets:validate assets/sprites/pilot-frog --release
pnpm assets:check
```

検証器は version、ID、空 pack、重複、ファイル参照、PNG の CRC と展開結果、色数、alpha、グリッド、フレーム番号、duration、必須 clip、接続点を検証する。
--release は承認済み metrics、目視項目、対象ファイルの SHA-256 digest 一致も要求する。
--digest は構造検証を通したファイル集合の digest を出し、承認は記録しない。
PNG、原画、pack.json のいずれかが変わったらレビューは無効になる。
source は存在と拡張子のみ自動確認し、編集可能性とレイヤー構造は人が開いて確認する。

assets:check と CI は assets/sprites 配下の全 pack を release モードで検証する。
ルートの pnpm test にもこの検証を組み込み、既存のデプロイ前テストからも実行する。
素材がまだ一つもなければ、未制作として明示する。
空の pack や不正なファイルを置いた場合は失敗させる。
構造検証の成功を、実装済み、全素材完成、目視合格の意味で表示しない。

## 14.7 目視レビューと承認

review.json は人が実物を見てから記録する。
AI が検査項目を埋めて未確認の画像を承認したことにしない。
レビュー記録は監査用の申告であり、本人認証や改ざん防止署名ではない。

```json
{
  "reviewer": "実際の確認者名",
  "reviewedAt": "2026-09-09",
  "digest": "--digest で得た SHA-256",
  "checks": {
    "anatomy": true,
    "fixedBody": true,
    "sideView": true,
    "readability": true,
    "attachments": true,
    "colors": true,
    "timing": true,
    "coverage": true
  }
}
```

| 項目 | 確認内容 |
|---|---|
| anatomy | カエルの目は頭の上の自然な目の位置。白い喉と腹へ目や口を描かない。全リアクションを五面資料と照合 |
| fixedBody | キャノピー、台座、座席の形と寸法が承認原画と同一。別の足回りや種でも変形しない |
| sideView | 真横。奥の履帯や天面を見せる透視表現が混ざらない |
| readability | 最小モバイル横画面、PC、ガレージ拡大、通常対戦サイズで顔、武器、主色が読める |
| attachments | オプションなし、メガネ、スカーフ、両方。左右、坂、全仰角 10〜90 度、反動で顔を覆わず接続点がずれない |
| colors | 全主色と副色の 49 通りで輪郭、キャラクター、固定色を維持 |
| timing | 低 HP の不安、大破の一度だけの反応、残骸の落胆。連射、多段着弾、画面破棄で残像や重複がない |
| coverage | この pack の納品範囲を満たす。原画が編集でき、前後レイヤーと必要方向を網羅 |

対象外の項目はレビューの notes に理由を記し、適用可否を確認したうえで true とする。
大きな見本だけで合格にせず、合成と実寸の確認画像の保存先も notes に記録する。
腹の解剖学・表情・魅力は目視確認する。顔の遮蔽・装備接触・ガラス・接地は指定したランドマークと実画素の両方で検査する。
[動作試験台](../../tools/asset-lab/README.md) で合成、フレーム送り、左右、仰角、色替えを確認できる。
武器とキャノピーの顔保護領域への重なりを raster で検査する。
実際の目の位置、全ポーズの装備対応、ゲーム内実寸の最終判断は目視確認を残す。

## 14.8 制作依頼に毎回添える情報

画像制作の依頼には、下記の項目を指定する。
未確定の寸法で依頼する場合は「試作」と明記し、完成 PNG の納品と区別する。

```text
制作区分：試作 / 納品用
pack ID と asset ID：
kind と用途：
参照：カエルだけ元の3D写真。それ以外は16章の新規採用ボード。旧タンク案を混ぜない
寸法：frameSize、artPixelsPerCell、余白を含むグリッド
固定条件：共通本体、真横視点、カエルの自然な目と白い腹
分離条件：素体、メガネ、スカーフ、武器、VFX を焼き込まない
色：PLTE の index 順と paletteRoles
動作：必要 clip、フレーム番号、duration、loop
接続：基準 anchors、必要な frameAnchors、顔の保護領域
納品：編集用原画、indexed PNG、pack.json
確認：構造検証の出力、実寸と合成の確認画像、未確認事項
```

生成ツールが指定寸法、indexed palette、分離レイヤーを保証できない場合、その出力は試作として扱う。
画像編集工程で輪郭、色、透過、グリッド、レイヤーを整え、実ファイルを検証してから納品する。
ツールへの指示文に条件を書いたことを、条件を満たした証拠にはしない。


## 14.9 baseline-v2 の追加ゲート

`qaProfile: modular-pilot-v2` は `generationModel: gpt-image-2.5-sunburst`、全ソースのSHA-256、半透明ガラス、装備接触、自然の目の非遮蔽、腰の遮蔽、履帯の幅と高さ・接地、砲口と発射原点、演出の拡張と消散、暖色VFXへのシアン混入、ガラスの枠外へのはみ出しを検査する。

`exportMetrics` に `sourceRegion` と `sourceHash` を保存する。生成シートが不等間隔なら透明な余白の中に正しいセル境界を採寸し直す。隣の絵を削って黙って取り込まない。採寸しても分離できなければ再生成する。出力側のフレームは常に固定グリッド。

ガラスの素材は面の透明度が失われないよう不透明な色面として生成し、出力時に面72/255・反射192/255へ変換する。生成された枠の行ごとの外周でマスクし、同じ形状の内側へ収める。この処理は `alphaMaskFrame` に記録する。縮尺を縦横別に変更して枠へ押し込まない。

`pnpm assets:export:v2` で再出力、`pnpm assets:validate assets/workbench/baseline-v2` で全ゲートを実行する。`pnpm assets:capture` は実際の試験台レンダラーからPC・モバイル・16ポーズ・8武器・32VFXコマと検査JSONを保存する。最新の生成条件はパックの `prompts/` と `generation.json` を正本にする。

連装武器は emissionPorts に各砲口の位置を記録し、発射光と弾を同じ位置から出す。発射光のソース各コマは発光開始点を採寸して登録し、同じセル内座標にあるという仮定を置かない。


## 14.10 塗装範囲と階調

黄色・ベージュ・クリームの車体面、砲身、キャノピー枠はハイライトと影までprimaryに含める。テラコッタのアクセントと履帯ハブはsecondary、キャラクター・装備・金属・透過ガラスはfixed。生成元の近似色が別のpalette indexへ量子化されても、同じ材質の階調を固定色として取り残さない。

baseline-v2の役割は `tools/asset-lab/paint.mjs` に明示する。主色はindex 5–13、26–29、副色は22–25。足回りの金属面は主色にしない。index 30/31の透過ガラスと反射は固定色。色の役割をRGBの色相から実行時に推測しない。

`paletteTones` は各indexに-1〜1の明暗を持つ。負値は黒へ、正値は白へ補間し、黒の塗装にもハイライトを残す。透明・半透明の画素は塗り替えない。manifestの全階調、黒・マゼンタ・青での車体残色、ガラスの不変性、49通りの配色を検査する。

### 弾の表示サイズ
baseline-v2の単発弾は武器全長60 artpxに対して幅18〜32 artpx、高さ7 artpx以上を確保する。triple（9×4）とmultiple（6×6）は小口径・連射用の例外。横幅だけを伸ばさず、元画像を等倍比率で縮小し、originを維持する。書き出し後は`projectile-size.test.mjs`と全武器の発射連続キャプチャを確認する。

### 黒い採掘爆弾・光弾・機体VFXの改訂（2026-09-09）
- `digger`は導火線と火花のある黒い球形爆弾。26×29 artpx（導火線込み）、球の中心をoriginに合わせる。金属製の掘削ヘッドに戻さない。
- `laser`は白い芯とシアンの縁だけで構成した光の棒。36×5 artpx。細長い光弾なので高さ下限は4 artpxとし、カプセル・金属キャップ・黒い輪郭を禁止する。
- 新規元画像は`generated/ammo-revised.png`、生成プロンプトとSHA256は同packの`prompts`と`generation.json`に保存。GPT Image 2.5 APIで作成する。
- 爆発の最大フレーム102×85、煙62×38、土煙73×47 artpx。非等方拡大を使わず、元画像からnearestで再出力する。
- `tools/asset-lab/effects.mjs`が機体VFXの発生時刻と位置を定義する。大破は0/80/140msから3か所で発生して600msまでにfade out。着地は履帯周辺3か所から450msで消散。低HPは900ms周期の煙を3本、残骸は4本、等間隔の位相で上昇・fadeさせる。煙の各フレームを独立した爆発として数えない。
- `effects.test.mjs`で発生数・位置・低HP発射中の煙・落下後の着地・遷移時の消失を検査する。`projectile-size.test.mjs`では黒い爆弾と金属色を含まない光弾、VFXの寸法下限を検査する。
- `pnpm assets:capture`で`fire.png`と`damage.png`を更新し、タンクとの比率、顔の読みやすさ、画面端の切れ、終端を目視する。表示上の演出でありsimulationの当たり判定・威力・地形破壊の数値を変更しない。

採掘弾（`digger`）の着弾演出は標準砲と同じ`effect-explosion`を使用する。黒い爆弾の見た目と通常爆発を組み合わせ、`effect-dig`には割り当てない。Browser testで同時刻の標準砲と採掘弾の着弾領域の画素が一致することを確認する。

残骸（`wreck`）は描画時に機体・搭乗者・装備・煙へ`grayscale(1)`を適用する。元アセットと選択中の塗装色は保持し、背景は変色させない。大破開始ではなく、600ms後に残骸状態へ遷移した時点で切り替える。通常状態へ戻した際はカラーで描画する。Browser testで通常色、残骸の無彩色、大破からの遷移、背景色の維持を確認する。

残骸の姿勢は、接地した履帯を固定したまま、車体・キャノピー・搭乗者・装備・砲台の支点を8 artpx下げる。砲身は保存された照準角とは独立して水平から18度下向きに固定する。損傷煙の発生源も車体の沈み込みに追従する。グレースケールと合わせて撃破済みを表現し、通常状態の描画では元の高さと照準角を使う。

発射反動は`firingMotion`で砲身と車体を共通の発射時刻から計算する。砲身最大3 artpxに対し、車体は最大2 artpx後退し、各発射から180msで復帰する。トリプル・マルチの各発射にも追従する。履帯は固定し、車体・キャノピー・搭乗者・装備・砲台は一緒に動かす。左右反転時は後退方向も反転する。ゲーム内の移動・当たり判定には加算しない。

発射中の搭乗者は通常の着座ポーズ（frame 0）を保持し、専用ののけぞりポーズは使わない。車体の後退にだけ追従する。pilotの`fire` clipはframe 0を180ms保持する非loop clipとする。

### 塗装面のドットノイズ除去
`paint-cleanup.mjs`でindexed化後の車体・武器のprimary塗装面を整理する。周囲8画素がすべて同じ塗装材質で、同階調の隣接画素がなく、5画素以上が一致する孤立点を周囲色へ置換する。透明境界・金属・アクセント・ガラス・キャラクターは変更しない。
車体front frame 1の大きな平面（x45〜97/y94〜109、前端x106〜123/y100〜113）は、内部の明るい塗装階調をindex12へ統一して斑点状のテクスチャを抑える。暗い構造線と別材質は維持する。これらの範囲はbaseline-v2の車体形状専用であり、別形状へ流用しない。元の生成画像は保持し、PNGとORAの両方へ同じ処理を適用する。青・黒・ピンクの比較画像`paint.png`とcleanupのUnit testsで確認する。
