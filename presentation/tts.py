"""台本の章ごとのナレーションを ElevenLabs で音声にする。

使い方: python3 presentation/tts.py <model_id> <章番号...>
API キーは macOS のキーチェーン（サービス名 elevenlabs-api-key）から読む。
同じ章を作り直すと take 番号を上げて別のファイルに書き、前の take を残す。
seed は take ごとに変えるので、take ごとに読み方が変わる。
文字ごとの時刻（alignment）を同じ名前の .json に保存し、映像の切り替えに使う。
"""

import base64
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

VOICE_ID = "xvM02WSHJg10Z10OboUn"
SEED = 20261001
ROOT = Path(__file__).parent
SCRIPT = ROOT / "script.md"

# 読み間違えた語を、合成に送る文だけで読みに置き換える。script.md は表記のまま残す。
# 合成が読み間違えた語だけを置き換える。英語の名前まで仮名にすると抑揚が崩れることがある。
# 「ターン制」を「ターンせい」に置き換えると、かえって「テーエヌセイ」と読まれたので、今は何も置き換えない。
READINGS: dict[str, str] = {}


def read_key() -> str:
    return subprocess.run(
        ["security", "find-generic-password", "-s", "elevenlabs-api-key", "-w"],
        check=True, capture_output=True, text=True,
    ).stdout.strip()


def chapters() -> dict[str, str]:
    body = SCRIPT.read_text(encoding="utf-8").split("\n---\n", 1)[1]
    result: dict[str, str] = {}
    for block in re.split(r"^## ", body, flags=re.M)[1:]:
        number = block.split(".", 1)[0]
        lines = [
            line.strip() for line in block.splitlines()[1:]
            if line.strip() and not line.startswith(("【", "---", "#"))
        ]
        result[number] = "\n".join(lines)
    return result


def spoken(text: str) -> str:
    for written, reading in READINGS.items():
        text = text.replace(written, reading)
    return text


def synthesize(payload: dict, key: str) -> dict:
    request = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/with-timestamps"
        "?output_format=mp3_44100_128",
        data=json.dumps(payload).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        sys.exit(f"{error.code}: {error.read().decode()}")


def next_take(out_dir: Path, number: str) -> Path:
    take = 1
    while (out_dir / f"ch{number}-take{take}.mp3").exists():
        take += 1
    return out_dir / f"ch{number}-take{take}.mp3"


def main() -> None:
    model_id, numbers = sys.argv[1], sys.argv[2:]
    key = read_key()
    texts = chapters()
    out_dir = ROOT / "audio" / model_id
    out_dir.mkdir(parents=True, exist_ok=True)
    for number in numbers:
        path = next_take(out_dir, number)
        take = int(path.stem.rsplit("take", 1)[1])
        # 前後の文は渡さない。最初に自然に聞こえた試作と同じ条件にそろえる。
        payload = {
            "text": spoken(texts[number]),
            "model_id": model_id,
            "language_code": "ja",
            "seed": SEED + take,
        }
        result = synthesize(payload, key)
        path.write_bytes(base64.b64decode(result["audio_base64"]))
        path.with_suffix(".json").write_text(
            json.dumps({"text": payload["text"], "alignment": result["alignment"]}, ensure_ascii=False),
            encoding="utf-8",
        )
        print(path)


if __name__ == "__main__":
    main()
