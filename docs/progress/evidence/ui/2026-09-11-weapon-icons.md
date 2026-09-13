# 武器アイコンの視認性調整

承認済み `desktop-refined-v4.png` と現在のゲーム画面を比較し、HUDで弾が小さく見える点を調整した。既存の弾スプライトは変更せず、SVG viewBoxを不透明領域に合わせ、直進弾を斜めに配置した。複数弾の配置も広げた。実際の飛翔エフェクトには影響しない。

## 検証

- client typecheck: 成功。
- client unit: 38 files / 236 tests 成功。
- 開発画面5186で Chromium / Firefox / WebKit、1440×900・667×375の武器ボタンが画面内に収まり、Eで2枠目が選択されることを確認。Qも送信したが、その選択状態はこの確認スクリプトではassertしていない。
- Chromium実画面: [weapon-icons-2026-09-11.png](./weapon-icons-2026-09-11.png)。既定装備のトリプル弾・貫通弾を視覚確認。
- この記録は開発ビルドの限定確認。8武器全種・実機タッチ・productionの総合確認を示すものではない。

UI全体の原案合わせと正式なアート承認は未完了。

## 配信ビルドでの全武器確認

`production-tests/weapon-hud.spec.ts` を追加。4組の装備をロビーで選択して練習へ入り、全8武器の画像decode・1440×900と667×375の画面内配置・Q/E両方向の選択/非選択状態を確認した。Chromium / Firefox / WebKit の12件成功（33.0秒）。client/e2e typecheck成功。前節のQ未assertという確認範囲を、この検証で補った。

拡大画像でトリプル弾の重なりを確認したため、3発を並列配置に修正して上記12件を再実行した。

- [通常弾・トリプル弾](./weapons-cannon-triple.png)
- [多弾・貫通弾](./weapons-multiple-drill.png)
- [レーザー・掘削弾](./weapons-laser-digger.png)
- [浮遊弾・スティンガー](./weapons-floater-stinger.png)

画像はChromiumの実HUD切り出し。全種を視覚確認した。実機タッチ・試合全体・正式アート承認の証拠ではない。
