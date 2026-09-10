# Final UI alignment artwork

## background-floating-islands-v1.png

- Generated with the built-in image generation tool on 2026-09-10.
- Reference: approved `output/imagegen/game-screen-functional-v1/desktop-refined-v4.png`.
- Brief: background-only, crisp pixel art; blue sky, distant floating stone islands, ivory castle, thin bridges, waterfalls and a low water horizon. Atmospheric cool colors so yellow tanks remain distinct. No UI, text, characters, tanks, projectiles or foreground destructible platforms.
- Original generation: `exec-12163271-ffae-46da-a90f-ed5b121502f6.png`.
- AI visual review: the generated image follows the reference environment and excludes gameplay/UI elements. Human final approval remains pending.
- Runtime encoding: `scripts/assets/encode-world.py`, WebP quality 94 with exact alpha/dimensions and RGB RMS error checks. Previous background sources are retained.

## terrain-rock-v1.png (candidate)

- Generated with the built-in image tool on 2026-09-10, reference desktop-refined-v4.png foreground cliffs.
- Source: exec-a782864c-e915-46e6-a617-352641393b39.png. Original retained; 1254x1254 output despite 1024 requested.
- Brief: full-bleed repeating rock material, charcoal/olive fractured slabs and sparse moss, no sky/UI/characters/grass border. Runtime supplies the arbitrary destruction mask and surface rim.
- AI review: rock/moss material matches the foreground direction more closely than brown soil. Repeat seams and apparent pixel density require in-game comparison. Not yet selected as runtime terrain; human approval pending.
