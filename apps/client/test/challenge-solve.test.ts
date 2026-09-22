import { it, expect } from "vitest";
import type { Profile } from "../src/app/profile";
import { initialChallenge, fireChallenge, completeChallenge } from "../src/practice/challenge";
import { STAGES } from "../src/practice/stages";
import { applyElevation, applySlot, applyStep } from "../src/match/control";
import { SOLUTIONS } from "./fixtures/challenge-solutions";

export const PROFILE: Profile = { playerId: "practice-test", nickname: "test", colors: { primary: "red", secondary: "yellow" }, loadout: ["laser", "stinger"], volume: 0.5, muted: true, swapPanels: false };

for (const [index, stage] of STAGES.entries()) {
  it(`${stage.id} ${stage.title}は規定弾数内にクリアでき、元の地形や装備を変更しない`, () => {
    const initial = initialChallenge(stage, PROFILE);
    const cells = initial.view.mask!.cells.slice();
    let state = initial;
    for (const action of SOLUTIONS[index]!) {
      let view = state.view;
      for (let i = 0; i < Math.abs(action.move); i++) view = applyStep(view, action.move > 0 ? 1 : -1);
      view = applyElevation(applySlot(view, action.slot), action.elevation - view.lastElevation);
      const fired = fireChallenge({ ...state, view }, action.power);
      expect(fired.status).toBe("playing");
      expect(fireChallenge(fired, 50)).toBe(fired);
      expect(completeChallenge(fired, stage, -1)).toBe(fired);
      state = completeChallenge(fired, stage, fired.used);
    }
    expect(state.status).toBe("clear");
    expect(state.used).toBeLessThanOrEqual(stage.shots);
    expect(initial.view.mask!.cells).toEqual(cells);
    expect(PROFILE.loadout).toEqual(["laser", "stinger"]);
    expect(fireChallenge(state, 50)).toBe(state);
  });
}

it("弾切れと再挑戦、無効入力、操作の引き継ぎ", () => {
  const stage = STAGES[0]!;
  let state = initialChallenge(stage, PROFILE);
  expect(fireChallenge(state, -1)).toBe(state);
  expect(fireChallenge(state, 101)).toBe(state);
  expect(fireChallenge(state, 1.5)).toBe(state);
  for (let i = 0; i < stage.shots; i++) {
    const fired = fireChallenge(state, 0);
    state = completeChallenge(fired, stage, fired.used);
  }
  expect(state.status).toBe("failed");
  const retry = initialChallenge(stage, PROFILE);
  expect(retry.used).toBe(0);
  expect(retry.targets.every((t) => !t.destroyed)).toBe(true);
  expect(retry.view.control?.stepsLeft).toBe(30);
});

it("移動の面は開始位置から一射で終わらず、壁の面は一射では抜けない", () => {
  for (const index of [4, 6]) {
    const stage = STAGES[index]!;
    const initial = initialChallenge(stage, PROFILE);
    for (const slot of [0, 1] as const) for (let elevation = 10; elevation <= 90; elevation++) for (let power = 0; power <= 100; power++) {
      const view = applyElevation(applySlot(initial.view, slot), elevation - 45);
      const fired = fireChallenge({ ...initial, view }, power);
      if (completeChallenge(fired, stage, 1).status === "clear") throw new Error(`${stage.id}: ${slot}/${elevation}/${power} で一射クリア`);
    }
  }
}, 30000);

it("支柱を撃つと的に爆風が届かなくても落下で壊れる", () => {
  const stage = STAGES[3]!;
  const initial = initialChallenge(stage, PROFILE);
  let found = false;
  for (let elevation = 10; elevation <= 90 && !found; elevation++) for (let power = 20; power <= 100 && !found; power++) {
    const view = applyElevation(initial.view, elevation - 45);
    const fired = fireChallenge({ ...initial, view }, power);
    const t = initial.targets[0]!;
    const direct = fired.view.replay!.shot.impacts.some(({ terrainOp: op }) => (op.cx - t.x) ** 2 + (op.cy - t.y + 8) ** 2 <= (op.radius + 3) ** 2);
    found = !direct && completeChallenge(fired, stage, 1).status === "clear";
  }
  expect(found).toBe(true);
});
