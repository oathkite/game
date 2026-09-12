# Rock arch alpha cleanup

Source: ../rock-arch-v1/terrain.png, generated with GPT Image.
User authorized programmatic alpha cleanup on 2026-09-12.

Reproduce:

```sh
python3 tools/clean-terrain-alpha.py assets/workbench/maps/rock-arch-v1/terrain.png assets/workbench/maps/rock-arch-v2/terrain.png
cwebp -quiet -lossless assets/workbench/maps/rock-arch-v2/terrain.png -o assets/runtime/maps/rock-arch-v2/terrain.webp
python3 tools/import-terrain-mask.py assets/workbench/maps/rock-arch-v2/terrain.png packages/maps/src/rockArchData.ts
```

Alpha at or below 160 becomes transparent; at or above 224 becomes opaque.
RGB and source dimensions (1672 × 941) remain unchanged. Runtime interpolation
reduces nearest-neighbor block edges but does not add native detail. Two GPT
Image refinement attempts returned opaque checkerboard backgrounds at the same
resolution and were rejected. Genuine higher-resolution artwork remains needed.
Collision data was rebuilt from this cleaned source; only rock-arch's expected
checksum changed. Spawn clearance, movement and bridge landing tests pass.
