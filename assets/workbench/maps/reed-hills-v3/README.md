# 葦の丘 v3 候補

GPT Image built-in generated source.png (1672×941), 2026-09-12.
Flat magenta background was deliberately requested for deterministic cleanup.
User authorized programmatic transparency processing earlier in this thread.

```sh
python3 tools/key-terrain-magenta.py assets/workbench/maps/reed-hills-v3/source.png assets/workbench/maps/reed-hills-v3/terrain.png
cwebp -quiet -q 90 assets/workbench/maps/reed-hills-v3/terrain.png -o assets/runtime/maps/reed-hills-v3/terrain.webp
python3 tools/import-terrain-mask.py assets/workbench/maps/reed-hills-v3/terrain.png packages/maps/src/reedHillsData.ts REED_HILLS
```

Warm limestone, golden reeds, asymmetric hills, a left-side tunnel with a solid
lower landing floor. Magenta key removes the flat backdrop and suppresses edge
spill. RGB rock/grass pixels outside the key hue remain unchanged.

REED_HILLS_SPEC is registered as v3 in the online catalog.
Hash binding, 2..8-player spawn and bilateral movement, cave landing tests pass.
Runtime artwork is keyed by map id AND version so a stored v2
match continues to use its original tile artwork and frozen geometry.
The source is not native 4K; standard 75% camera scale remains in effect.
