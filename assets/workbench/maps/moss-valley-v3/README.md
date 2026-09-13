# 苔の谷 v3

Generated with built-in GPT Image, 2026-09-12. Original source.png: 1870×841 RGBA.
The prompt requested a flat magenta backdrop, but the tool returned actual alpha.
Therefore this asset uses alpha cleanup, not magenta keying.

```sh
python3 tools/clean-terrain-alpha.py assets/workbench/maps/moss-valley-v3/source.png assets/workbench/maps/moss-valley-v3/terrain.png
cwebp -quiet -q 90 assets/workbench/maps/moss-valley-v3/terrain.png -o assets/runtime/maps/moss-valley-v3/terrain.webp
python3 tools/import-terrain-mask.py assets/workbench/maps/moss-valley-v3/terrain.png packages/maps/src/mossValleyData.ts MOSS_VALLEY 500 225
```

Dark sandstone with deep green moss, central low valley, right-side natural
cave and solid lower landing floor. Source retained; programmatic alpha cleanup
was authorized by the user. Runtime artwork is selected only for moss-valley v3;
v2 saved matches keep their frozen geometry and previous tile artwork.

Hash binding, 2..8-player spawns, both movement directions and cave landing have
been tested. Native image detail remains limited; camera defaults to 75%.
