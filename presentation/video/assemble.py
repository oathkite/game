"""章ごとの映像をつなぎ、BGM を一定の音量で敷いて 1 本の動画にする。

使い方: python3 presentation/video/assemble.py
入力は presentation/video/out/ch<章>.mp4（render.mjs の出力）と presentation/cues.json。
出力は presentation/video/out/presentation.mp4。

BGM はゲームの曲を使い、音量は全体で同じにする（声に合わせて上げ下げしない）。
  0 章〜6 章の「音楽をつけると」の行まで: hangar
  そこから 7 章の「実はこの動画も」の行まで: ridgeline（対戦の主題曲）
  その後: result
曲の切り替えは 2 秒のクロスフェードでつなぐ。
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "out"
MUSIC = ROOT.parent.parent / "apps" / "client" / "src" / "assets" / "music"
CHAPTERS = [str(n) for n in range(8)]
BGM_LUFS = -32.0
FADE = 2.0
MUSIC_LINE = 6  # 6 章の「音楽をつけると」の行
RESULT_LINE = 2  # 7 章の「実はこの動画も」の行


def run(*args: str) -> str:
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(result.stderr)
    return result.stdout + result.stderr


def duration(path: Path) -> float:
    return float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)))


def loudness(path: Path) -> float:
    log = run("ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-")
    return float(log.rsplit("I:", 1)[1].split("LUFS")[0])


def segment(track: str, seconds: float, target: Path) -> None:
    source = MUSIC / f"{track}.ogg"
    gain = BGM_LUFS - loudness(source)
    run("ffmpeg", "-v", "error", "-y", "-stream_loop", "-1", "-i", str(source), "-t", f"{seconds:.3f}",
        "-af", f"volume={gain:.2f}dB", "-ar", "48000", "-ac", "2", str(target))


def main() -> None:
    cues = json.loads((ROOT.parent / "cues.json").read_text(encoding="utf-8"))
    parts = [OUT / f"ch{n}.mp4" for n in CHAPTERS]
    lengths = [duration(p) for p in parts]
    starts = [sum(lengths[:i]) for i in range(len(parts))]
    total = sum(lengths)

    listing = OUT / "concat.txt"
    listing.write_text("".join(f"file '{p.name}'\n" for p in parts), encoding="utf-8")
    joined = OUT / "joined.mp4"
    run("ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(joined))

    # 切り替えの時刻。クロスフェードの真ん中がその時刻に来るように、前の曲を FADE / 2 だけ長くする。
    to_theme = starts[6] + cues["6"]["lines"][MUSIC_LINE]["start"] - 0.5
    to_result = starts[7] + cues["7"]["lines"][RESULT_LINE]["start"] - 0.5
    plan = [("hangar", to_theme), ("ridgeline", to_result - to_theme), ("result", total - to_result)]
    files = []
    for i, (track, seconds) in enumerate(plan):
        pad = FADE / 2 * ((i > 0) + (i < len(plan) - 1))
        target = OUT / f"bgm-{i}-{track}.wav"
        segment(track, seconds + pad, target)
        files.append(target)

    bgm = OUT / "bgm.wav"
    run("ffmpeg", "-v", "error", "-y", *sum((["-i", str(f)] for f in files), []),
        "-filter_complex",
        f"[0][1]acrossfade=d={FADE}:c1=tri:c2=tri[a];[a][2]acrossfade=d={FADE}:c1=tri:c2=tri,"
        f"afade=t=in:d=1,afade=t=out:st={total - 3:.3f}:d=3[out]",
        "-map", "[out]", "-t", f"{total:.3f}", str(bgm))

    final = OUT / "presentation.mp4"
    run("ffmpeg", "-v", "error", "-y", "-i", str(joined), "-i", str(bgm),
        "-filter_complex", "[0:a]aformat=channel_layouts=stereo[v];[v][1:a]amix=inputs=2:normalize=0[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}",
        "-movflags", "+faststart", str(final))
    print(f"{final} {total:.1f}s")
    for n, s in zip(CHAPTERS, starts):
        print(f"  ch{n} {int(s // 60)}:{s % 60:04.1f}")
    print(f"  ridgeline {int(to_theme // 60)}:{to_theme % 60:04.1f}, result {int(to_result // 60)}:{to_result % 60:04.1f}")


if __name__ == "__main__":
    main()
