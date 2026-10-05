import { describe, expect, it, vi } from "vitest";
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

describe("チュートリアル向けの盤面（設計書 44）", () => {
  const plain = { ...STAGES[0]!, targets: [] as const, shots: 99 };
  const replay = (store: ReturnType<typeof createChallengeStore>): void => {
    const job = store.getView().replay!;
    for (const impact of job.shot.impacts) store.showImpact(job.maskAfter, impact);
    store.completeReplay(job.id);
  };

  it("的は途中で足せ、足すまでは撃ってもクリアにならない", () => {
    const store = createChallengeStore(plain, profile);
    expect(store.getTargets()).toEqual([]);
    store.fire(30);
    replay(store);
    expect(store.getState().status).toBe("playing");
    store.addTargets([[180, 180]]);
    store.addTargets([[230, 180]]);
    expect(store.getTargets().map(t => [t.x, t.y, t.destroyed])).toEqual([[180, 180, false], [230, 180, false]]);
    expect(new Set(store.getTargets().map(t => t.id)).size).toBe(2);
  });

  it("endless では的をすべて壊しても終わらず、続けて撃てる", () => {
    const store = createChallengeStore(STAGES[0]!, profile, { endless: true });
    store.selectSlot(1);
    store.changeElevation(-21);
    store.fire(80);
    replay(store);
    expect(store.getTargets().every(t => t.destroyed)).toBe(true);
    expect(store.getState().status).toBe("playing");
    expect(store.getView().phase).toBe("acting");
    store.fire(10);
    expect(store.getView().phase).toBe("replaying");
  });

  it("風を変えると表示と次の射撃の両方に効く", () => {
    const store = createChallengeStore(plain, profile);
    store.setWind(8);
    expect(store.getView().wind.value).toBe(8);
    store.fire(60);
    expect(store.getView().replay!.shot.input.wind).toBe(8);
  });

  it("アイテムは許したときだけ選べる。チャレンジでは選べない（設計書 37.6）", () => {
    const challenge = createChallengeStore(STAGES[0]!, profile);
    challenge.selectItem("double");
    expect(challenge.getView().control!.item).toBeNull();
    const tutorial = createChallengeStore(plain, profile, { items: true });
    tutorial.selectItem("double");
    expect(tutorial.getView().control!.item).toBe("double");
    tutorial.selectItem(null);
    expect(tutorial.getView().control!.item).toBeNull();
  });

  it("ダブルシュートは生きた的があれば2発目を撃ち、使ったアイテムはもう選べない", () => {
    const store = createChallengeStore(plain, profile, { items: true, endless: true });
    store.addTargets([[300, 180]]);
    store.selectItem("double");
    store.fire(30);
    const job = store.getView().replay!;
    expect(job.shot.input.item).toBe("double");
    expect(job.firstShot).toBeDefined();
    expect(job.paths.length).toBe(job.firstShot!.paths * 2);
    replay(store);
    expect(store.getView().players![0].itemsUsed).toEqual(["double"]);
    expect(store.getView().control!.item).toBeNull();
    store.selectItem("double");
    expect(store.getView().control!.item).toBeNull();
  });

  it("テレポートは地形を削らず、弾が当たった場所へ自機を移す", () => {
    const store = createChallengeStore(plain, profile, { items: true });
    const before = store.getView().control!.x;
    store.selectItem("teleport");
    store.fire(50);
    const job = store.getView().replay!;
    expect(job.shot.input.item).toBe("teleport");
    expect(job.shot.impacts).toEqual([]);
    expect(job.maskAfter.cells).toEqual(job.maskBefore.cells);
    replay(store);
    expect(store.getView().control!.x).toBeGreaterThan(before + 10);
    expect(store.getView().players![0].itemsUsed).toEqual(["teleport"]);
  });
});
