# Green pilot SVG v2

Editable vector pixel-art pilot matching the green skin, pale muzzle and olive jacket of the HUD portrait. Authored as SVG under the user's permission to draw SVG assets; no image API or CLI generation was used. The previous generated sheet candidates remain retained in pilot-generic-v1 and are not used.

Run `node assets/workbench/pilot-generic-v2/build.mjs` to regenerate pilot-frog.svg, then `node scripts/assets/runtime-tanks.mjs --write` to copy it into the runtime manifest. The original baseline-v2 yellow pilot source remains untouched.

The 768×640 sheet uses sixteen 192×160 cells matching the existing animation frame indices: idle/blink 0–2, move 3–4, fire 5–6, hit 7–8, low HP 9–10, fall 11, land 12, destruction 13–14, wreck 15. These are newly drawn poses, not pixel-identical copies of the earlier animations. Integer SVG paths and crispEdges keep binary alpha. Every frame has a common foot row 100. The renderer retains its existing recoil, falling, landing and wreck transforms.

Browser validation: all sixteen frames have green skin and olive cloth, no partial alpha, and stay within the seat region. Desktop lobby/game and wreck/recovery were inspected. Human final visual approval remains pending; compare these simplified side-view features with the detailed HUD portrait before formal art-pack approval.

2026-09-11 refinement: rounded stepped eye outlines, larger pupils/highlights, and a wider pale smiling muzzle replace the rectangular eye treatment. Pose offsets, frame order, jacket and common foot row are preserved. The existing browser alpha/seat test passed across all16frames; production reentry/GPU upload tests passed in Chromium, Firefox and WebKit. See docs/progress/evidence/ui/pilot-face-comparison.png. This is a simplified small sprite interpretation, not a pixel-identical HUD portrait or a record of final human approval.
