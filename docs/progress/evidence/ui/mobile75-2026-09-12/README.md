# 75%カメラのモバイル確認

Chromium/Firefox/WebKitで667×375 touch表示と開幕入力制御を検証。
最初の6件中WebKit desktopのみ素材読込中に既定5秒で失敗。
読込完了を別途15秒待ち、開幕/START/操作解放を検証するよう修正後、
WebKitの2件は成功（47.9秒）。ロード中の操作禁止も確認する。

モバイル3browserでは戦場高さ200px超、左側十字キー、右側発射を確認。
webkit.pngは実配信buildのタッチ表示。実iOS端末による性能検証ではない。
画像地形の多人数への移行箇所はdesign/34-image-terrain-migration.mdに記録。
