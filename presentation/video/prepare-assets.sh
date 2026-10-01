#!/usr/bin/env bash
# 映像の素材を presentation/video/assets/ に作り直す。素材は大きいので git に入れず、ここから再生成する。
#
# 使い方: PROMO=<紹介動画.mp4> X_VIDEO=<Xの動画.mp4> presentation/video/prepare-assets.sh
#   PROMO   アーティファクト「TANK SHOOT 紹介動画」の tank-shoot-promo-20261001.mp4
#           （sha256 64467bae342ae11a…。コンペ提出版は後から文字を外したので別のファイル）
#   X_VIDEO https://x.com/rehan_shei/status/2102794467032154206 の動画（投稿者の了承を得て使用）
#           例: yt-dlp -f "bv*+ba/b" --merge-output-format mp4 -o x-effect.mp4 <URL>
# 録音ツールのサーバー（python3 presentation/recorder_server.py、8771）を起動してから実行する。
# アーティファクトの撮影（capture.mjs）が presentation/ をそのサーバー経由で開くため。
set -euo pipefail

: "${PROMO:?PROMO に紹介動画のパスを渡す}"
: "${X_VIDEO:?X_VIDEO に X の動画のパスを渡す}"
cd "$(dirname "$0")/../.."
REPO="$(pwd)"
A=presentation/video/assets
mkdir -p "$A"

# 生成画像のころの画面と、偽の市松模様が描き込まれた生成画像（8da9d28 で削除されたので親から取る）。
cp docs/progress/graphic-version-archive-2026-09-13/captures/journey-chromium-1440-battle.png "$A/gen-battle.png"
cp docs/progress/graphic-version-archive-2026-09-13/captures/image-terrain-after-chromium.png "$A/gen-crater.png"
git show '8da9d28^:assets/workbench/pilot-generic-v1/sheet-candidate-01.png' > "$A/gen-pilot-checker.png"

# 紹介動画から切り出すコマと連番。
ffmpeg -v error -y -ss 12 -i "$PROMO" -frames:v 1 -update 1 "$A/dot-wide.png"
mkdir -p "$A/ch4-clip"
ffmpeg -v error -y -ss 30.5 -t 5.4 -i "$PROMO" -vf fps=30 -q:v 3 "$A/ch4-clip/%03d.jpg"
clip() {
  mkdir -p "$A/clips/$1"
  ffmpeg -v error -y -ss "$3" -t "$4" -i "$2" -vf "fps=30,scale=1920:1080" -q:v 3 "$A/clips/$1/%04d.jpg"
}
clip promo-play "$PROMO" 7.62 11.43
clip promo-zoomout "$PROMO" 3.81 3.81
clip promo-follow "$PROMO" 15.24 3.81
clip promo-laser "$PROMO" 36.19 3.81
clip promo-logo "$PROMO" 43.81 4.2
clip x-blizzard "$X_VIDEO" 8.0 6.0
clip x-meteor "$X_VIDEO" 16.0 6.0

# アーティファクト（初日のモック、地形スケッチ、演出案）を動かして撮る。
node presentation/video/capture.mjs

# 1 章の後ろで流す、対戦画面の移り変わり（日付の順）。
mkdir -p "$A/timelapse"
i=0
for f in "$A/radar-game.png" \
  docs/design/previews/camera-prototype/1440x900.png \
  docs/design/previews/battle-hud-v1/desktop.png \
  docs/design/previews/world-ui/world-battle-1440.png \
  docs/progress/evidence/ui/moss-valley-2026-09-12/chromium.png \
  docs/progress/evidence/ui/refinement-2026-09-12/eight-player-battle.png \
  docs/progress/evidence/ui/simple-dot-2026-09-13/journey-webkit-1440-battle.png \
  docs/progress/evidence/ui/tank-polish-2026-09-13/tank-polish-desktop.png \
  "$A/dot-wide.png"; do
  i=$((i + 1))
  ffmpeg -v error -y -i "$f" -vf scale=1440:-1 -update 1 "$A/timelapse/$(printf %02d "$i").png"
done

# 6 章の波形。Suno の曲とゲームの主題曲から、720 区間の最大振幅と、頭と終わりの 0.5 秒の音量を取る。
python3 - "$REPO" <<'PY'
import array, json, math, subprocess, sys
repo = sys.argv[1]
def env(path, bins=720):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True, check=True).stdout
    a = array.array("h"); a.frombytes(raw)
    step = len(a) / bins
    peaks = [round(max((abs(x) for x in a[int(i * step):int((i + 1) * step)]), default=0) / 32768, 3) for i in range(bins)]
    rms = lambda s: math.sqrt(sum(x * x for x in s) / len(s)) / 32768
    return {"peaks": peaks, "headRms": round(rms(a[:4000]), 3), "tailRms": round(rms(a[-4000:]), 3), "duration": round(len(a) / 8000, 2)}
out = {
    "suno": env(f"{repo}/assets/workbench/audio/suno-2026-09-11/battle-a.m4a"),
    "ridgeline": env(f"{repo}/apps/client/src/assets/music/ridgeline.ogg"),
}
json.dump(out, open(f"{repo}/presentation/video/assets/waveforms.json", "w"))
PY

# 7 章で並べる、この動画自体のコマ。章の絵を先に作ってから撮る。
node presentation/video/stills.mjs 0 15
node presentation/video/stills.mjs 1 26 34.5
node presentation/video/stills.mjs 2 17
node presentation/video/stills.mjs 3 29
node presentation/video/stills.mjs 4 24.5
node presentation/video/stills.mjs 5 21
node presentation/video/stills.mjs 6 25.5
mkdir -p "$A/meta"
i=0
for f in ch0-15 ch1-26 ch2-17 ch3-29 ch4-24.5 ch5-21 ch6-25.5 ch1-34.5; do
  i=$((i + 1))
  ffmpeg -v error -y -i "presentation/video/out/stills/$f.png" -vf scale=640:-1 -update 1 "$A/meta/$i.png"
done
echo "assets: $(du -sh "$A" | cut -f1)"
