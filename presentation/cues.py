"""録音のどこで台本のどの行を話しているかを求め、presentation/cues.json に書く。

ElevenLabs の音声認識（文字ごとの時刻つき）で録音を書き起こし、台本の文字列と突き合わせる。
台本と少し違う言い方で読んでも、一致する文字の時刻から行の頭を決める。
書き起こしは presentation/recordings/clean/ch<章>.stt.json に保存し、あれば使い回す。
"""

import json
import subprocess
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from tts import chapters, read_key  # noqa: E402

ROOT = Path(__file__).parent
CLEAN = ROOT / "recordings" / "clean"


def transcribe(path: Path) -> dict:
    cache = path.with_suffix(".stt.json")
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    result = subprocess.run(
        ["curl", "-sS", "--fail-with-body", "-X", "POST", "https://api.elevenlabs.io/v1/speech-to-text",
         "-H", f"xi-api-key: {read_key()}",
         "-F", "model_id=scribe_v1", "-F", "language_code=jpn", "-F", "timestamps_granularity=character",
         "-F", f"file=@{path}"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        sys.exit(f"音声認識に失敗した: {result.stdout or result.stderr}")
    cache.write_text(result.stdout, encoding="utf-8")
    return json.loads(result.stdout)


def significant(c: str) -> bool:
    return unicodedata.category(c)[0] in "LN"


def characters(stt: dict) -> list[tuple[str, float]]:
    chars = []
    for word in stt["words"]:
        for c in word.get("characters") or [{"text": word["text"], "start": word["start"]}]:
            for ch in unicodedata.normalize("NFKC", c["text"]).lower():
                if significant(ch):
                    chars.append((ch, c["start"]))
    return chars


def line_starts(lines: list[str], spoken: list[tuple[str, float]]) -> list[float]:
    script, owner = [], []
    for i, line in enumerate(lines):
        for ch in unicodedata.normalize("NFKC", line).lower():
            if significant(ch):
                script.append(ch)
                owner.append(i)
    matcher = SequenceMatcher(None, script, [c for c, _ in spoken], autojunk=False)
    first: dict[int, float] = {}
    for block in matcher.get_matching_blocks():
        for k in range(block.size):
            first.setdefault(owner[block.a + k], spoken[block.b + k][1])
    starts = []
    for i in range(len(lines)):
        if i not in first:
            sys.exit(f"{i + 1} 行目「{lines[i]}」に一致する言葉が録音に見つからない")
        starts.append(round(first[i], 2))
    return starts


def duration(path: Path) -> float:
    return float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    ).stdout)


def main() -> None:
    result = {}
    for number, text in chapters().items():
        lines = text.splitlines()
        path = CLEAN / f"ch{number}.wav"
        stt = transcribe(path)
        starts = line_starts(lines, characters(stt))
        result[number] = {
            "duration": round(duration(path), 2),
            "spoken": stt["text"],
            "lines": [{"start": s, "text": t} for s, t in zip(starts, lines)],
        }
        print(f"ch{number}", starts)
    (ROOT / "cues.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
