"""Encode runtime artwork losslessly; preserve original pixels and provenance."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FILES = {
    "logo": "ui-polish-v1/logo.png",
    "background": "world-ui-final/background-floating-islands-v1.png",
    "lobby": "world-ui-v1/lobby-v1.png",
    "settings": "world-ui-v1/settings-v1.png",
    "result": "world-ui-v1/result-v1.png",
    "terrain": "ui-polish-v1/terrain.png",
    "leaf": "world-ui-v1/leaf-v1.png",
    "panel": "world-ui-v1/panel-v1.png",
    "button": "world-ui-v1/button-v2.png",
    "meter": "world-ui-v1/meter-v1.png",
    "cockpit": "ui-polish-v1/cockpit.png",
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(check):
    target = ROOT / "assets/runtime/world-v1"
    target.mkdir(parents=True, exist_ok=True)
    records = []
    for name, source in FILES.items():
        original = ROOT / "assets/workbench" / source
        output = target / f"{name}.webp"
        image = Image.open(original).convert("RGBA")
        if not check:
            image.save(output, "WEBP", lossless=True, exact=True, method=6)
        decoded = Image.open(output).convert("RGBA")
        if image.size != decoded.size or image.tobytes() != decoded.tobytes():
            raise ValueError(f"Pixel mismatch: {name}")
        records.append({"id": name, "source": str(original.relative_to(ROOT)),
                        "file": output.name, "sourceSha256": digest(original),
                        "sha256": digest(output), "size": list(image.size),
                        "sourceBytes": original.stat().st_size, "bytes": output.stat().st_size})
    manifest = {"version": 1, "encoding": "lossless-webp-exact-rgba", "assets": records}
    path = target / "manifest.json"
    if check:
        if json.loads(path.read_text()) != manifest:
            raise ValueError("Runtime manifest is stale")
    else:
        path.write_text(json.dumps(manifest, indent=2) + "\n")
    before = sum(item["sourceBytes"] for item in records)
    after = sum(item["bytes"] for item in records)
    print(f"Verified {len(records)} exact RGBA images: {before} -> {after} bytes ({100 * (1 - after / before):.1f}% smaller)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    run(parser.parse_args().check)
