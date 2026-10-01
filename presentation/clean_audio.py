"""録音したナレーションのノイズを減らし、音量をそろえる。

使い方:
  python3 presentation/clean_audio.py            # selections.json で採用した take を全部処理する
  python3 presentation/clean_audio.py <入力> <出力>  # 1 ファイルだけ処理する

処理の順序:
  1. 80 Hz より下を切る（空調や机の振動）
  2. FFT でノイズを減らす。録音ごとにノイズの大きさを測って、減らす基準にする
  3. 話していない間の残りのノイズを、ゲートで 20 dB 下げる
  4. サ行の歯擦音を少し抑える
  5. 軽く圧縮して、声の大小の差を縮める
  6. 前後の無音を切り、0.3 秒の余白を残す
  7. ラウドネスを測って音量を上げ下げし、-16 LUFS にそろえる。ピークはリミッターで -1.5 dBFS に抑える
出力は 48 kHz、モノラルの WAV。
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
RECORDINGS = ROOT / "recordings"
CLEAN = RECORDINGS / "clean"
TARGET_LUFS = -16.0
LIMIT = 0.84  # -1.5 dBFS

TRIM = (
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.3,"
    "areverse,"
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.3,"
    "areverse"
)


def chain(noise_floor: float) -> str:
    return ",".join([
        "highpass=f=80",
        f"afftdn=nr=20:nf={noise_floor:.1f}:tn=1",
        f"agate=threshold={10 ** ((noise_floor + 12) / 20):.5f}:ratio=4:attack=5:release=250:range=0.1",
        "deesser=i=0.3",
        "acompressor=threshold=-20dB:ratio=3:attack=10:release=150:makeup=2",
        TRIM,
    ])


def ffmpeg(*args: str) -> str:
    result = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", *args],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        sys.exit(result.stderr)
    return result.stderr


def noise_floor(source: Path) -> float:
    log = ffmpeg("-i", str(source), "-af", "highpass=f=80,astats=metadata=0", "-f", "null", "-")
    value = float(re.findall(r"Noise floor dB: (-?[\d.]+|-inf)", log)[-1].replace("-inf", "-80"))
    return min(-20.0, max(-80.0, value))


def loudness(source: Path, filters: str) -> float:
    log = ffmpeg("-i", str(source), "-af", f"{filters},ebur128", "-f", "null", "-")
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", log)[-1])


def clean(source: Path, target: Path) -> None:
    filters = chain(noise_floor(source))
    gain = TARGET_LUFS - loudness(source, filters)
    target.parent.mkdir(parents=True, exist_ok=True)
    # リミッターがピークを削った分だけ届かないので、測り直してもう一度合わせる。
    for _ in range(2):
        final = f"{filters},volume={gain:.2f}dB,alimiter=limit={LIMIT}:level=false"
        ffmpeg("-y", "-i", str(source), "-af", final, "-ar", "48000", "-ac", "1", str(target))
        result = loudness(target, "anull")
        gain += TARGET_LUFS - result
    print(f"{target.name}: {result:.1f} LUFS")


def main() -> None:
    if len(sys.argv) == 3:
        clean(Path(sys.argv[1]), Path(sys.argv[2]))
        return
    selections = json.loads((RECORDINGS / "selections.json").read_text(encoding="utf-8"))
    for number, name in sorted(selections.items(), key=lambda item: int(item[0])):
        if not re.fullmatch(r"ch\d+-take\d+\.webm", name):
            sys.exit(f"採用した take の名前が不正です: {name}")
        clean(RECORDINGS / name, CLEAN / f"ch{number}.wav")


if __name__ == "__main__":
    main()
