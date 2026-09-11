# BGMループ境界の検証

2026-09-11。測定対象は既存配信音源（dc9ca93）。ffmpegで48kHz/stereo float32にデコードした末尾と先頭の差をmeasurements.jsonに記録。近傍100msの隣接サンプル差の99 percentileも比較した。これはクリックの聴感判定や拍・和声の連続性の評価ではない。

result.opusでは端点差-17.08dBFS、近傍差p99は-29.38dBFS。大きな段差があるため、Web Audioデコード後、BGMの両端2msへ線形フェードを適用する。エンコード後に処理することで、codecの端部誤差も含めて両端をゼロにする。ループの尺・中間サンプル・効果音は維持する。曲の前後1秒クロスフェードは既存のまま。

unit testでは修正前の失敗を確認し、修正後は音声関連12件成功。production buildでChromium/Firefox/WebKit各1件成功。4曲の全8chの実AudioBuffer端点ゼロと内部の信号、シーン切替・音量・ミュート・試合終了音を確認した。

以下は境目を4秒位置に置いた8秒の試聴用抜粋。softenedは同じ2ms処理を適用した比較用ファイル。共有用MP3再エンコードを経るため、ゲーム内PCMの測定用ではない。聴感レビューと音楽的な拍・和声の接続確認は未完。

| 曲 | 修正前 | 修正後 |
| --- | --- | --- |
| title | [前](title-seam.mp3) | [後](title-softened-seam.mp3) |
| lobby | [前](lobby-seam.mp3) | [後](lobby-softened-seam.mp3) |
| battle | [前](battle-seam.mp3) | [後](battle-softened-seam.mp3) |
| result | [前](result-seam.mp3) | [後](result-softened-seam.mp3) |
