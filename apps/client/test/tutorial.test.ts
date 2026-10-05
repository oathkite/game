import { expect, it } from "vitest";
import { createChallengeStore, type ChallengeStore } from "../src/practice/store";
import { advanceTutorial, AIM_DEGREES, MOVE_CELLS, TUTORIAL_STAGE, TUTORIAL_STEPS, type TutorialStep } from "../src/practice/tutorial";
import type { ChallengeState } from "../src/practice/challenge";
import type { Profile } from "../src/app/profile";
import { TUTORIAL_SOLUTION } from "./fixtures/challenge-solutions";

const profile: Profile = { playerId: "test", nickname: "", colors: { primary: "red", secondary: "yellow" }, loadout: ["laser", "stinger"], volume: 0, muted: true, swapPanels: false };

/** 画面と同じく、手番の始まりを基準にして状態が変わるたびに判定する */
const guide = (store: ChallengeStore, start: TutorialStep) => {
  let step = start, from: ChallengeState = store.getState();
  store.subscribe(() => {
    const next = advanceTutorial(step, from, store.getState());
    if (next !== step) { step = next; from = store.getState(); }
  });
  return { step: () => step };
};
const replay = (store: ChallengeStore): void => {
  const job = store.getView().replay!;
  for (const impact of job.shot.impacts) store.showImpact(job.maskAfter, impact);
  store.completeReplay(job.id);
};
/** 解法は開始位置から撃つ前提なので、そこまで歩いて戻る */
const walkHome = (store: ChallengeStore): void => {
  const home = TUTORIAL_STAGE.start[0];
  while (store.getView().control!.x !== home) store.moveStep(store.getView().control!.x < home ? 1 : -1);
};
const shoot = (store: ChallengeStore, { slot, elevation, power }: { readonly slot: 0 | 1; readonly elevation: number; readonly power: number }): void => {
  store.selectSlot(slot);
  store.changeElevation(elevation - store.getView().lastElevation);
  store.fire(power);
  replay(store);
};

it("導入と完了は状態が変わってもボタンでだけ進む", () => {
  const store = createChallengeStore(TUTORIAL_STAGE, profile);
  const before = store.getState();
  store.changeElevation(20);
  store.moveStep(1);
  expect(advanceTutorial("intro", before, store.getState())).toBe("intro");
  expect(advanceTutorial("done", before, store.getState())).toBe("done");
  expect(TUTORIAL_STEPS).toEqual(["intro", "aim", "move", "weapon", "fire", "target", "done"]);
});

it("促した操作をしたときだけ、角度、移動、武器、発射、的の順に進む", () => {
  const store = createChallengeStore(TUTORIAL_STAGE, profile);
  const tutorial = guide(store, "aim");
  store.moveStep(1);
  store.selectSlot(1);
  store.selectSlot(0);
  store.changeElevation(AIM_DEGREES - 1);
  expect(tutorial.step()).toBe("aim");
  store.changeElevation(1);
  expect(tutorial.step()).toBe("move");
  store.changeElevation(30);
  store.selectSlot(1);
  for (let i = 1; i < MOVE_CELLS; i++) store.moveStep(-1);
  expect(tutorial.step()).toBe("move");
  store.moveStep(-1);
  expect(tutorial.step()).toBe("weapon");
  store.moveStep(1);
  expect(tutorial.step()).toBe("weapon");
  store.selectSlot(0);
  expect(tutorial.step()).toBe("fire");
  // 外し弾は的の先の遠くへ落とし、開始位置の足場を削らない
  store.changeElevation(20 - store.getView().lastElevation);
  store.fire(100);
  expect(tutorial.step()).toBe("fire");
  replay(store);
  expect(tutorial.step()).toBe("target");
  shoot(store, { slot: 1, elevation: 20, power: 100 });
  expect(tutorial.step()).toBe("target");
  walkHome(store);
  shoot(store, TUTORIAL_SOLUTION);
  expect(tutorial.step()).toBe("done");
});

it("角度は下げても進み、戻して差がなくなれば進まない", () => {
  const store = createChallengeStore(TUTORIAL_STAGE, profile);
  const from = store.getState();
  store.changeElevation(-AIM_DEGREES);
  expect(advanceTutorial("aim", from, store.getState())).toBe("move");
  store.changeElevation(AIM_DEGREES);
  expect(advanceTutorial("aim", from, store.getState())).toBe("aim");
});

it("促す前に的を壊したら、残りの手順を飛ばして完了へ進む", () => {
  const store = createChallengeStore(TUTORIAL_STAGE, profile);
  const tutorial = guide(store, "move");
  shoot(store, TUTORIAL_SOLUTION);
  expect(store.getState().status).toBe("clear");
  expect(tutorial.step()).toBe("done");
});

it("撃ってから再生が終わるまでは、的が壊れていても完了にしない", () => {
  const store = createChallengeStore(TUTORIAL_STAGE, profile);
  const from = store.getState();
  store.selectSlot(TUTORIAL_SOLUTION.slot);
  store.changeElevation(TUTORIAL_SOLUTION.elevation - 45);
  store.fire(TUTORIAL_SOLUTION.power);
  const job = store.getView().replay!;
  for (const impact of job.shot.impacts) store.showImpact(job.maskAfter, impact);
  expect(advanceTutorial("fire", from, store.getState())).toBe("fire");
  store.completeReplay(job.id);
  expect(advanceTutorial("fire", from, store.getState())).toBe("done");
});

it("チュートリアルの面は外し続けても弾切れで失敗しない", () => {
  const store = createChallengeStore(TUTORIAL_STAGE, profile);
  for (let i = 0; i < 20; i++) shoot(store, { slot: 0, elevation: 80, power: 20 + (i % 3) });
  expect(store.getState().status).toBe("playing");
  expect(TUTORIAL_STAGE.shots).toBeGreaterThanOrEqual(99);
});

it("歩数を使い切っても場外に落ちず、射撃のたびに歩数が戻る", () => {
  const store = createChallengeStore(TUTORIAL_STAGE, profile);
  for (let turn = 0; turn < 12; turn++) {
    for (let i = 0; i < 40; i++) store.moveStep(-1);
    shoot(store, { slot: 0, elevation: 80, power: 1 });
  }
  expect(store.getState().status).toBe("playing");
  expect(store.getView().control!.stepsLeft).toBeGreaterThan(0);
});
