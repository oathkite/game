import { expect, it, vi } from "vitest";
import { createChallengeStore } from "../src/practice/store";
import { STAGES } from "../src/practice/stages";
import type { Profile } from "../src/app/profile";
const profile: Profile = { playerId: "test", nickname: "", colors: { primary: "red", secondary: "yellow" }, loadout: ["laser", "stinger"], volume: 0, muted: true, swapPanels: false };

it("移動・仰角・武器を共有操作で更新し、射撃後に移動歩数を回復する", () => {
  const store = createChallengeStore(STAGES[0]!, profile);
  const notify = vi.fn();
  const off = store.subscribe(notify);
  expect(store.canStep(1)).toBe(true);
  store.moveStep(1);
  store.changeElevation(5);
  store.selectSlot(1);
  expect(store.getView().control).toMatchObject({ x: 61, elevation: 50, slot: 1, stepsLeft: 29 });
  store.fire(30);
  expect(store.getState().used).toBe(1);
  store.completeReplay(1);
  expect(store.getView().control).toMatchObject({ elevation: 50, slot: 1, stepsLeft: 30 });
  expect(notify).toHaveBeenCalledTimes(5);
  off();
  store.changeElevation(1);
  expect(notify).toHaveBeenCalledTimes(5);
});


it("着弾時に的の表示を更新し、射撃完了で確定する", () => {
  const store = createChallengeStore(STAGES[0]!, profile);
  store.selectSlot(1);
  store.changeElevation(-21);
  store.fire(80);
  const job = store.getView().replay!;
  const before = store.getTargets();
  expect(before[0]?.destroyed).toBe(false);
  for (const impact of job.shot.impacts) store.showImpact(job.maskAfter, impact);
  expect(store.getTargets()[0]?.destroyed).toBe(true);
  expect(before[0]?.destroyed).toBe(false);
  expect(store.getState().status).toBe("playing");
  store.completeReplay(job.id);
  expect(store.getState().status).toBe("clear");
});


it("移動で場外に落ちた時点で失敗し、追加の射撃を必要としない", () => {
  const stage = { ...STAGES[0]!, platforms: [[0, 180, 60, 224] as const] };
  const store = createChallengeStore(stage, profile);
  store.moveStep(1);
  expect(store.getState().status).toBe("failed");
  expect(store.getView().phase).toBe("finished");
  expect(store.getState().used).toBe(0);
  store.fire(50);
  expect(store.getState().used).toBe(0);
});
