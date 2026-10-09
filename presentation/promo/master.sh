#!/usr/bin/env bash
# edit.mjs の映像と audio.mjs の音を合わせ、配信用に縮める。
# 使い方: presentation/promo/master.sh [出力のパス]（既定は out/tank-shoot-promo-20261009.mp4）
# 音は -16 LUFS にそろえる（プレゼン動画の clean_audio.py と同じ）。終わりの 0.6 秒で映像を黒へ落とす。
set -euo pipefail
cd "$(dirname "$0")/out"
OUTPUT="${1:-tank-shoot-promo-20261009.mp4}"
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 video.mp4)
FADE_AT=$(python3 -c "print(round($DURATION - 0.6, 3))")
# 1 回目で音の大きさを測り、2 回目でその値を渡して線形にそろえる（圧縮をかけない）
MEASURE=$(ffmpeg -hide_banner -i audio.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
val() { echo "$MEASURE" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i video.mp4 -i audio.wav \
  -filter_complex "[0:v]fade=t=out:st=${FADE_AT}:d=0.6[v];[1:a]loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$(val input_i):measured_TP=$(val input_tp):measured_LRA=$(val input_lra):measured_thresh=$(val input_thresh):offset=$(val target_offset):linear=true,aresample=48000[a]" \
  -map '[v]' -map '[a]' -c:v libx264 -preset slow -crf 25 -tune animation -pix_fmt yuv420p -r 60 \
  -c:a aac -b:a 160k -movflags +faststart "$OUTPUT"
ls -l "$OUTPUT"
