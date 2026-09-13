# Eight-browser natural combat verification

Run from the repository root:

```sh
pnpm --filter @game/e2e exec playwright test --config=natural-match.config.ts
```

The dedicated config runs a long scenario separately from the normal rooms suite. Each browser engine gets eight independent browser contexts, creates a public 4v4 room through the UI, and uses the default cannon/digger equipment on moss-valley. An offline test selector evaluates candidate shots from the public authoritative frame, then sends a normal turn.fire command through the actor browser's authenticated WebSocket. It does not inject HP, terrain, victory, surrender, clock changes, or a replacement server frame.

After every shot and its real replay duration, the test compares the eight received states (players/HP/positions, terrain operations, wind, phase, turn and result). It verifies final shot totals, result-table visibility and all eight returning to the same room. This exercises actual browser rendering and room transport, but shot input is protocol-driven rather than keyboard/touch driven; existing input E2E covers those UI controls separately. The test selector is not a gameplay bot feature.

Runtime source at execution: a2112f3, with the new test/config in this commit. Production client build and local Wrangler SQLite Durable Objects. No deployment or main integration. Whole suite: 3 passed, 4.9 minutes.

| Engine | Shots | Result | Terrain operations | Fired turn IDs |
| --- | ---: | --- | ---: | --- |
| Chromium | 23 | Blue wins (t0) | 23 | 1–23, consecutive |
| Firefox | 24 | Red wins (t1) | 24 | 1–24, consecutive |
| WebKit | 24 | Blue wins (t0) | 24 | 1–24, consecutive |

`natural-match-*.json` retain accepted command inputs, post-turn HP, terrain-operation counts, build and outcome. `run.log` records the executed command's output. A preliminary Chromium run also completed in 22 shots but did not persist a JSON report; it is not the basis of the table above.

Limits: one 4v4 scenario per engine, one map, default two weapons, local transport and machine. This is not an all-seed/all-formation browser proof, real-device/region performance benchmark, memory-soak result, or human playability/balance evaluation. It complements the existing engine formation/weapon/map matrices and the earlier surrender-based room lifecycle E2E.
