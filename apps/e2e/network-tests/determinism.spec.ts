import { expect, test } from "@playwright/test";
import { flatMask, shot, simulateConcurrentCombat } from "@game/sim";
import { WEAPON_IDS } from "@game/protocol";
test("v2 concurrent trajectories and terrain agree between Node and browser for all weapons", async ({ page }) => {
  const players = Array.from({ length: 8 }, (_, i) => ({ x: 60 + i * 36, y: 150, hp: 100 }));
  const inputs = WEAPON_IDS.map(weapon => shot({ weapon, power: 85, wind: -10 }));
  const summarize = (result: ReturnType<typeof simulateConcurrentCombat>) => ({ impacts: result.impacts, hpAfter: result.hpAfter, positions: result.positions, paths: result.paths, terrain: Array.from(result.mask.cells) });
  const expected = inputs.map(input => summarize(simulateConcurrentCombat(flatMask(), players, input)));
  await page.goto("/");
  const actual = await page.evaluate(async ({ players, inputs }) => {
    const entry = "/src/networkLab/determinism.ts";
    const { simulateCases } = await import(entry);
    return simulateCases(players, inputs);
  }, { players, inputs });
  expect(actual).toEqual(expected);
});
