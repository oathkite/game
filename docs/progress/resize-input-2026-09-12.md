# 画面サイズ変更時の長押し入力解除

新しいオンライン対戦の `useBattleInput` はblur・visibilitychangeに対応していたが、resize時に長押しを解除していなかった。横向きのままウィンドウサイズを変えると充填が続き、100で発射されることをChromiumで再現した（期待0、実際100）。練習側の `usePrototypeInput` はすでにresizeで解除している。

オンライン側もresizeで移動・照準のholdとパワー充填をキャンセルし、入力所有者を解除する。イベント解除も追加した。画面が変わった後のpointerupで発射せず、新たな押下を受け付ける。

## 検証

- `pnpm --filter @game/e2e exec playwright test --config dev.config.ts resize-input.spec.ts`: Chromium / Firefox / WebKitの3件成功（32.6秒）。独立2contextで実Roomへ入室・開始後、発射ボタンのpointer長押し中に横向きresize、次に縦向きへ変更。古い入力からのturn.fire送信0件、横向きへ復帰後のタップで1件だけ送信・replayingを確認。
- 最初の修正後試験はキーボード入力によってタッチボタンを隠す仕様にテストが対応せず失敗。ボタンのpointer長押しへ直し、上記3件で再検証した。仕様を変えてボタンを常設してはいない。
- clientの単体試験243件成功。client / e2e型チェック成功。
- dev.config.tsを3ブラウザ対象に拡張。既存の画像地形試験は保持するが、今回その試験を再実行したとは扱わない。

ブラウザのviewport変更とpointer/touch入力の自動検証。実iOS/Androidのorientationイベント・画面キーボード・OSジェスチャーの保証にはしない。配信用111件の前回結果とは実行対象を区別する。
