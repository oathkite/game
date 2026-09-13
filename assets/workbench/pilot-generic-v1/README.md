# Generic green pilot — candidate workbench

Generated with the built-in image tool on 2026-09-11, following the user's instruction to use the in-app image generator, not an API/CLI path. Human visual approval remains pending.

References: baseline-v2/pilot-frog.png for the 4x4 pose layout; world-ui-final/pilot-portrait-v1.png for green skin, cream throat and olive jacket. No glasses or scarf; separate from the owner's personal avatar.

- sheet-candidate-01.png: exec-da6fa2bc-b1d8-4d60-9755-ce79bae22e90.png, original1374x1145 RGB. The design follows the green seated pilot direction but paints the checkerboard into RGB. Rejected for runtime use; background is not transparent. Original retained unchanged.
- Integration must preserve the original tank's seat registration and authored animation order. Do not replace runtime before alpha, all16frames and in-game occlusion are verified.

- sheet-candidate-02.png: exec-536c6d4d-4573-4525-9b09-d94f6c0e2550.png, original1374x1145 RGB. Edit request explicitly required removal of every checkerboard pixel and genuine alpha=0 gutters while preserving sprites. Output still contains a painted checkerboard, has no alpha channel, and changes sprite size. Rejected for runtime use.

Two built-in attempts did not meet the transparency/registration requirements. Neither file is registered in the runtime manifest. Existing gameplay remains unchanged; HUD/gameplay identity alignment is not complete. No API fallback was used.
