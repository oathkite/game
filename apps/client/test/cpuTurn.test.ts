import { expect, it } from "vitest";
import { createEngine, DEFAULT_ENGINE_TIMING } from "@game/engine";
import { flatMask, validateMove } from "@game/sim";
import { planCpuTurn } from "../src/practice/cpuTurn";
const initial = () => {
  const state = createEngine({ ...DEFAULT_ENGINE_TIMING, rng: () => 0.5 }, { roomCode: "CPU000", mapName: "ridgeline", players: [
    { nickname: "Player", colors: { primary: "red", secondary: "yellow" }, loadout: ["cannon", "triple"] },
    { nickname: "CPU", colors: { primary: "cyan", secondary: "blue" }, loadout: ["cannon", "triple"] },
  ] });
  return { ...state, mask: flatMask(), match: { ...state.match, players: [{ ...state.match.players[0], x: 60, y: 150 }, { ...state.match.players[1], x: 300, y: 150 }] as const } };
};
it("理由が無くても乱数が小さければ安全な経路で位置を変え、砲塔調整・構えを経て撃つ", () => {
  const state = initial();
  const plan = planCpuTurn(state, "normal", 45, () => 0.1);
  expect(plan.fire.x).not.toBe(300);
  expect(validateMove(state.mask, state.match.players[1], plan.fire.x)).not.toBeNull();
  expect(plan.frames.some(f => f.pose.elevation !== 45)).toBe(true);
  expect(plan.frames.some(f => f.pose.power > 0)).toBe(true);
  expect(plan.duration).toBeGreaterThan(2500);
  expect(plan.duration).toBeLessThan(14000);
  expect(plan.frames.every((f, i) => i === 0 || f.at > plan.frames[i - 1]!.at)).toBe(true);
  expect(state.match.players[1].x).toBe(300);
});
it("乱数に応じて待ち時間が変わり、留まる選択肢もある", () => {
  const state = initial();
  const still = planCpuTurn(state, "easy", 45, () => 0.8);
  const moving = planCpuTurn(state, "easy", 45, () => 0.1);
  expect(still.fire.x).toBe(300);
  expect(moving.fire.x).not.toBe(300);
  expect(moving.duration).not.toBe(still.duration);
});

it("崖へ向かう移動は落ちる前に止める", () => {
  const state = initial();
  const cells = state.mask.cells.slice();
  for (let x = 0; x < 295; x++) for (let y = 0; y < state.mask.height; y++) cells[y * state.mask.width + x] = 0;
  const cliff = { ...state, mask: { ...state.mask, cells } };
  const plan = planCpuTurn(cliff, "normal", 45, () => 0.8);
  expect(plan.fire.x).toBeGreaterThanOrEqual(295);
  expect(plan.frames.every(frame => frame.pose.y < state.mask.height)).toBe(true);
});

it("今の位置から当てられなければ、相手から離れる向きでも当てられる位置へ動く", () => {
  // CPU の頭上から左へ屋根を張る。屋根の下からは撃ち出せず、右へ 18 歩出ると屋根越しに山なりで届く
  const state = initial();
  const cells = state.mask.cells.slice();
  for (let x = 240; x <= 305; x++) for (let y = 125; y < 136; y++) cells[y * state.mask.width + x] = 1;
  const cave = { ...state, mask: { ...state.mask, cells }, match: { ...state.match, wind: { ...state.match.wind, value: 0 } } };
  for (const roll of [0, 0.5, 0.99]) expect(planCpuTurn(cave, "hard", 45, () => roll).fire.x).toBe(318);
});
