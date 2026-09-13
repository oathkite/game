import { expect, it, vi } from "vitest";
import { maskFromHeights, simulateShot, shot } from "@game/sim";
import { playReplay } from "../src/game/replay";
import type { Renderer } from "../src/game/renderer";
import type { PlayerView, ReplayJob } from "../src/match/types";

it.each([0, 1] as const)("starts seat %i replay at the confirmed crater position, never its old height", seat => {
  const mask = maskFromHeights(Array.from({ length: 400 }, (_, x) => x >= 65 && x <= 90 ? 170 : 150), 225);
  const player = (index: 0 | 1): PlayerView => ({ seat: index, nickname: `p${index}`, colors: { primary: "red", secondary: "blue" }, loadout: ["cannon", "digger"],
    x: index === seat ? 60 : 300, y: 150, hp: 100, facing: 1, connected: true });
  const players = [player(0), player(1)] as const;
  const input = shot({ seat, x: 70, y: 170, elevation: 45 });
  const simulated = simulateShot(mask, players, input);
  const after = players.map((p, i) => ({ ...p, x: simulated.result.xAfter[i]!, y: simulated.result.yAfter[i]!, hp: simulated.result.hpAfter[i]! })) as unknown as readonly [PlayerView, PlayerView];
  const job: ReplayJob = { id: 1, shot: simulated.result, paths: simulated.paths, maskBefore: mask, maskAfter: simulated.mask, playersBefore: players, playersAfter: after };
  const setTank = vi.fn();
  const renderer = { setTank, projectile: () => ({ clear: vi.fn() }), onFrame: () => vi.fn(), setShake: vi.fn() } as unknown as Renderer;
  const stop = playReplay(renderer, job, [45, 45], seat, { sound: vi.fn(), done: vi.fn(), reduceMotion: true });
  const poses = setTank.mock.calls.filter(([index]) => index === seat).map(([, pose]) => pose);
  expect(poses.length).toBeGreaterThan(0);
  for (const pose of poses) expect(pose).toMatchObject({ x: 70, y: 170 });
  stop();
});
