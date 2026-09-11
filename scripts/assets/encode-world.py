"""Encode runtime artwork with explicit per-asset fidelity and provenance."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[2]
FILES = {
    "pilot-result-expressions": "world-ui-final/pilot-result-expressions-v1.png",
    "pilot-portrait": "world-ui-final/pilot-portrait-v1.png",
    "logo": "ui-polish-v1/logo.png",
    "background": "world-ui-final/background-floating-islands-v1.png",
    "lobby": "world-ui-v1/lobby-v1.png",
    "settings": "world-ui-v1/settings-v1.png",
    "result": "world-ui-v1/result-v1.png",
    "terrain": "world-ui-final/terrain-cliff-v2.png",
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
        lossy = name in {"background", "button"}
        encoding = "webp-q94" if lossy else "lossless-webp-exact-rgba"
        if not check:
            image.save(output, "WEBP", quality=94 if lossy else 80, lossless=not lossy, exact=True, method=6)
        decoded = Image.open(output).convert("RGBA")
        if image.size != decoded.size or image.getchannel("A").tobytes() != decoded.getchannel("A").tobytes():
            raise ValueError(f"Dimensions/alpha mismatch: {name}")
        rms = ImageStat.Stat(ImageChops.difference(image, decoded)).rms
        if (lossy and max(rms) > 6) or (not lossy and image.tobytes() != decoded.tobytes()):
            raise ValueError(f"Pixel fidelity mismatch: {name}: {rms}")
        records.append({"id": name, "source": str(original.relative_to(ROOT)),
                        "encoding": encoding, "channelRms": rms, "file": output.name, "sourceSha256": digest(original),
                        "sha256": digest(output), "size": list(image.size),
                        "sourceBytes": original.stat().st_size, "bytes": output.stat().st_size})
    manifest = {"version": 2, "encoding": "per-asset-webp", "assets": records}
    path = target / "manifest.json"
    if check:
        if json.loads(path.read_text()) != manifest:
            raise ValueError("Runtime manifest is stale")
    else:
        path.write_text(json.dumps(manifest, indent=2) + "\n")
    before = sum(item["sourceBytes"] for item in records)
    after = sum(item["bytes"] for item in records)
    print(f"Verified {len(records)} fidelity-checked images: {before} -> {after} bytes ({100 * (1 - after / before):.1f}% smaller)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    run(parser.parse_args().check)
