# Runtime world artwork

`assets/workbench`の生成PNGを配信用に可逆圧縮したもの。構図・寸法・透明度・RGBA画素は変更しない。
元PNGと生成記録はworkbenchに保持する。最終デザイン承認やsprite packの承認を意味しない。

再生成: `python3 scripts/assets/encode-world.py`
検証: `python3 scripts/assets/encode-world.py --check`
依存: Python 3、Pillow（WebP対応）。`scripts/assets/requirements.txt`を参照。
manifestは元/出力SHA-256、寸法、容量を記録する。検証はRGBAの完全一致とmanifest一致を確認する。
アート変更時は元PNGを更新後に再生成し、ゲーム内で表示を確認する。
