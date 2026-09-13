# 苔むす岩橋 — image terrain pilot

Generated with the built-in GPT Image tool on 2026-09-12. No image API was used.

## Generation brief

Transparent, side-on widescreen cutout for KEROPOD: two substantial moss-covered rocky floating islands connected by a natural arched stone bridge, with a separate broad landable rock shelf below. Natural angular strata, irregular silhouette, fine pixel detail and large readable rock masses. Gentle walkable top surfaces, clear air under the arch, no background, UI, characters or buildings. The complete composition is a single authored image, not a repeatable tile.

`terrain.png` is the unmodified generated source. The runtime `assets/runtime/maps/rock-arch-v1/terrain.webp` is a quality-90 WebP encoding with alpha retained.

## Collision import

Requires Python 3 and Pillow. From the repository root:

```sh
python3 tools/import-terrain-mask.py assets/workbench/maps/rock-arch-v1/terrain.png packages/maps/src/rockArchData.ts
```

The importer reads alpha, samples coverage into a 400×225 grid, uses threshold 160/255, and excludes vertical runs shorter than four cells. It writes deterministic column spans plus the source SHA-256. It never edits the source image. Clients and the engine use this frozen data; image decoding is not part of physics.

Spawn x positions 85 and 305 were selected for safe, nearly level ground. At x=200 the upper bridge and lower shelf are separate collision runs. Bridge destruction and landing on the lower shelf are covered by tests.

## Scope

The world-art practice scene uses this pilot. Existing maps and the two online multiplayer map definitions remain available. A full online migration should transport the authored initial mask and replay the exact destruction history on initial load/reconnect, and needs per-map 2–8 player spawn/balance validation before adoption.
