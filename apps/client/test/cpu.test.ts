import { expect, it } from "vitest";
import { createEngine, DEFAULT_ENGINE_TIMING } from "@game/engine";
import { simulateShot } from "@game/sim";
import { chooseCpuShot } from "../src/practice/cpu";

const initial = () => createEngine({ ...DEFAULT_ENGINE_TIMING, rng: () => 0.5 }, {
  roomCode: "CPU000", mapName: "ridgeline", players: [
    { nickname: "Player", colors: { primary: "red", secondary: "yellow" }, loadout: ["cannon", "triple"] },
    { nickname: "CPU", colors: { primary: "cyan", secondary: "blue" }, loadout: ["cannon", "triple"] },
  ],
});
it("CPUは同じ盤面なら同じ合法手を選び、元の地形を変えない", () => {
  const state = initial();
  const cells = state.mask.cells.slice();
  const fire = chooseCpuShot(state);
  expect(chooseCpuShot(state)).toEqual(fire);
  expect(fire).toMatchObject({ type: "turn.fire", x: state.match.players[1].x, facing: -1 });
  expect(fire.power).toBeGreaterThan(0);
  expect(fire.power).toBeLessThanOrEqual(100);
  expect(state.mask.cells).toEqual(cells);
});
it("初期マップでは相手にダメージを与える射撃を選ぶ", () => {
  const state = initial();
  const fire = chooseCpuShot(state);
  const player = state.match.players[1];
  const result = simulateShot(state.mask, state.match.players, { ...fire, seat: 1, weapon: player.loadout[fire.slot], y: player.y, wind: state.match.wind.value }).result;
  expect(result.hpAfter[0]).toBeLessThan(state.match.players[0].hp);
});
