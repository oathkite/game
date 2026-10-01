#!/bin/sh
# 全章の映像を書き出す。録音ツールのサーバー（8771）が動いている前提。
set -e
cd "$(dirname "$0")/../.."
for ch in 0 1 2 3 4 5 6 7; do
  node presentation/video/render.mjs "$ch" 30
done
