# Archived BGM (2026-09-14 to 2026-09-23)

Replaced on 2026-09-23 by the synthesized soundtrack in `docs/design/39-soundtrack-and-sfx.md`.
The files below were moved here unchanged from `apps/client/src/assets/music` as a production record.


The eight OGG files provided by the user in `Chiptune_BGM_8tracks` on
2026-09-14 replace the generated soundtrack. Audio bytes are copied unchanged;
`provenance.json` in this folder records filenames and SHA-256 hashes.

| Source | Usage |
| --- | --- |
| 01_departure | Title / departure preparation |
| 02_lobby | Room browser (lobby) |
| 03_room | Room details |
| 04_stone_bridge | Stone bridge |
| 05_ridgeline | Ridgeline |
| 06_hills | Terraces |
| 07_floating_islands | Floating islands |
| 08_results | All results, independent of outcome |

Loop points in `loops.json` are exact source sample positions divided by 44100,
not rounded display durations. Playback starts at zero and loops the whole track.
There is no padding offset, normalization, waveform taper or additional composition.
Scene transitions crossfade over 450 ms. Same-track calls do not restart playback.
Only requested files download; two decoded tracks are cached.

The composition scripts that lived in `tools/music` before 2026-09-14 were rejected studies.
The current `tools/music` is the 2026-09-23 renderer and is unrelated to them.
