"""ナレーションの録音ツールを配る小さなサーバー。

使い方: python3 presentation/recorder_server.py [port]
http://localhost:8771/recorder.html を開くと、章ごとに台本を見ながら録音できる。
録音は presentation/recordings/ch<章>-take<番号>.webm に保存し、前の take は消さない。
選んだ take は presentation/recordings/selections.json に書く。
"""

import json
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).parent
SCRIPT = ROOT / "script.md"
RECORDINGS = ROOT / "recordings"
SELECTIONS = RECORDINGS / "selections.json"
MAX_BYTES = 50 * 1024 * 1024


def chapters() -> list[dict]:
    body = SCRIPT.read_text(encoding="utf-8").split("\n---\n", 1)[1]
    result = []
    for block in re.split(r"^## ", body, flags=re.M)[1:]:
        head = block.splitlines()[0]
        lines = [
            line.strip() for line in block.splitlines()[1:]
            if line.strip() and not line.startswith(("【", "---", "#"))
        ]
        result.append({"n": head.split(".", 1)[0], "title": head.split("（", 1)[0], "lines": lines})
    return result


def takes() -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for path in sorted(RECORDINGS.glob("ch*-take*.webm"), key=lambda p: int(p.stem.rsplit("take", 1)[1])):
        number = path.stem.split("-", 1)[0][2:]
        result.setdefault(number, []).append(path.name)
    return result


def selections() -> dict[str, str]:
    return json.loads(SELECTIONS.read_text(encoding="utf-8")) if SELECTIONS.exists() else {}


def next_take(number: str) -> Path:
    take = 1
    while (RECORDINGS / f"ch{number}-take{take}.webm").exists():
        take += 1
    return RECORDINGS / f"ch{number}-take{take}.webm"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, data: object, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self) -> bytes | None:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BYTES:
            self.send_json({"error": "本文の大きさが不正です"}, 400)
            return None
        return self.rfile.read(length)

    def do_GET(self) -> None:
        if urlparse(self.path).path == "/api/state":
            self.send_json({"chapters": chapters(), "takes": takes(), "selections": selections()})
            return
        super().do_GET()

    def do_POST(self) -> None:
        url = urlparse(self.path)
        number = parse_qs(url.query).get("ch", [""])[0]
        if not re.fullmatch(r"\d{1,2}", number):
            self.send_json({"error": "章の番号が不正です"}, 400)
            return
        body = self.read_body()
        if body is None:
            return
        RECORDINGS.mkdir(exist_ok=True)
        if url.path == "/api/save":
            path = next_take(number)
            path.write_bytes(body)
            self.send_json({"saved": path.name})
        elif url.path == "/api/select":
            name = json.loads(body).get("take", "")
            if name not in takes().get(number, []):
                self.send_json({"error": "その take はありません"}, 400)
                return
            chosen = selections() | {number: name}
            SELECTIONS.write_text(json.dumps(chosen, ensure_ascii=False, indent=2), encoding="utf-8")
            self.send_json({"selections": chosen})
        else:
            self.send_json({"error": "not found"}, 404)


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8771
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
