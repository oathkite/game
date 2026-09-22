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

it("難易度ごとに照準誤差を変え、むずかしいは従来の精度を維持する", () => {
  const state = initial();
  const hard = chooseCpuShot(state);
  expect(chooseCpuShot(state, "hard", () => 0)).toEqual(hard);
  const easy = chooseCpuShot(state, "easy", () => 0);
  const normal = chooseCpuShot(state, "normal", () => 0);
  expect(easy.power).toBe(Math.max(1, hard.power - 20));
  expect(normal.power).toBe(Math.max(1, hard.power - 8));
  expect(easy.elevation).toBe(Math.max(10, hard.elevation - 12));
  expect(normal.elevation).toBe(Math.max(10, hard.elevation - 5));
  expect(easy).not.toEqual(hard);
});

it("誤差を加えても射角とパワーを合法範囲に保つ", () => {
  for (const level of ["easy", "normal"] as const) {
    for (const roll of [0, 0.5, 0.9999]) {
      const fire = chooseCpuShot(initial(), level, () => roll);
      expect(fire.elevation).toBeGreaterThanOrEqual(10);
      expect(fire.elevation).toBeLessThanOrEqual(90);
      expect(fire.power).toBeGreaterThanOrEqual(1);
      expect(fire.power).toBeLessThanOrEqual(100);
      expect(Number.isInteger(fire.power)).toBe(true);
    }
  }
});

it("やさしい・ふつうは実際の弾道で外す場合がある", () => {
  const state = initial();
  const actor = state.match.players[1];
  for (const level of ["easy", "normal"] as const) {
    const damage = [0, 0.2, 0.4, 0.6, 0.8, 0.999].map(roll => {
      const fire = chooseCpuShot(state, level, () => roll);
      return actor.hp - simulateShot(state.mask, state.match.players, { ...fire, seat: 1, weapon: actor.loadout[fire.slot], y: actor.y, wind: state.match.wind.value }).result.hpAfter[0];
    });
    expect(damage).toContain(0);
  }
});
