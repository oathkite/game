# Runtime world artwork

元PNGと生成記録はworkbenchに保持する。最終デザイン承認やsprite packの承認を意味しない。
背景と共通ボタンはWebP quality 94、それ以外は可逆WebP。構図・寸法・alphaは変更しない。
非可逆の2素材はRGB各チャンネルのRMS誤差6/255以下、alpha完全一致を検証する。
他の10素材はRGBA完全一致。これは画質の自動承認ではなく、表示比較も必要。

再生成: `python3 scripts/assets/encode-world.py`
検証: `python3 scripts/assets/encode-world.py --check`
依存: Python 3、Pillow（WebP対応）。`scripts/assets/requirements.txt`を参照。
manifest v2は元/出力SHA-256、寸法、容量、素材ごとのencodingと画素誤差を記録する。
Nodeのassets:checkはhash/容量/誤差記録を確認し、Pythonのcheckは実際の画素差を再計算する。
