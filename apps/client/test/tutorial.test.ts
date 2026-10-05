import { expect, it } from "vitest";
import { createChallengeStore, type ChallengeStore } from "../src/practice/store";
import {
  ITEM_TARGET, nextTutorialStep, tutorialItems, observeTutorial, startTutorialStep, TUTORIAL_BUTTON_STEPS, TUTORIAL_STAGE, TUTORIAL_STEPS, TUTORIAL_TARGET, TUTORIAL_WIND, tutorialSetup,
  type TutorialProgress, type TutorialStep,
} from "../src/practice/tutorial";
import type { Profile } from "../src/app/profile";
import { TUTORIAL_SOLUTION } from "./fixtures/challenge-solutions";

const profile: Profile = { playerId: "test", nickname: "", colors: { primary: "red", secondary: "yellow" }, loadout: ["laser", "stinger"], volume: 0, muted: true, swapPanels: false };
const tutorialStore = () => createChallengeStore(TUTORIAL_STAGE, profile, { endless: true, items: true });

/** 画面と同じく、状態が変わるたびに 1 つずつ見て、手順に入ったら盤面を準備する */
const guide = (store: ChallengeStore, start: TutorialStep) => {
  let progress: TutorialProgress = startTutorialStep(start, store.getState());
  let previous = store.getState();
  const prepare = (step: TutorialStep): void => {
    const setup = tutorialSetup(step);
    const have = store.getTargets().length;
    if (have < setup.targets.length) store.addTargets(setup.targets.slice(have));
    if (store.getView().wind.value !== setup.wind) store.setWind(setup.wind);
  };
  store.subscribe(() => {
    const now = store.getState();
    const next = observeTutorial(progress, previous, now);
    previous = now;
    const entered = next.step !== progress.step;
    progress = next;
    if (entered) prepare(next.step);
  });
  prepare(start);
  return { step: () => progress.step, press: () => { progress = startTutorialStep(nextTutorialStep(progress.step), store.getState()); prepare(progress.step); } };
};
const replay = (store: ChallengeStore): void => {
  const job = store.getView().replay!;
  for (const impact of job.shot.impacts) store.showImpact(job.maskAfter, impact);
  store.completeReplay(job.id);
};
/** 解法は開始位置から右を向いて撃つ前提なので、そこまで歩いて戻る（左へ行き過ぎてから右へ 1 歩） */
const walkHome = (store: ChallengeStore): void => {
  const home = TUTORIAL_STAGE.start[0];
  while (store.getView().control!.x >= home) store.moveStep(-1);
  while (store.getView().control!.x < home) store.moveStep(1);
};
const shoot = (store: ChallengeStore, { slot, elevation, power }: { readonly slot: 0 | 1; readonly elevation: number; readonly power: number }): void => {
  store.selectSlot(slot);
  store.changeElevation(elevation - store.getView().lastElevation);
  store.fire(power);
  replay(store);
};
/** 的の先の遠くへ外す。開始位置の足場を削らない */
const miss = { slot: 0, elevation: 20, power: 100 } as const;

it("手順は12個で、説明の手順だけが「次へ」で進む", () => {
  expect(TUTORIAL_STEPS).toEqual(["intro", "aim", "move", "weapon", "fire", "memo", "target", "wind", "timer", "double", "teleport", "done"]);
  expect(TUTORIAL_BUTTON_STEPS).toEqual(["intro", "timer", "done"]);
  expect(nextTutorialStep("intro")).toBe("aim");
  expect(nextTutorialStep("done")).toBe("done");
});

it("ボタンの手順と目安の線は、盤面が変わっても自動では進まない", () => {
  for (const step of [...TUTORIAL_BUTTON_STEPS, "memo"] as const) {
    const store = tutorialStore();
    const tutorial = guide(store, step);
    store.changeElevation(20);
    store.changeElevation(-20);
    store.moveStep(1);
    store.moveStep(-1);
    store.selectSlot(1);
    store.selectSlot(0);
    expect(tutorial.step()).toBe(step);
  }
});

it("角度は上げると下げるの両方をしたときだけ進む", () => {
  const store = tutorialStore();
  const tutorial = guide(store, "aim");
  for (let i = 0; i < 5; i++) store.changeElevation(1);
  store.moveStep(1);
  store.selectSlot(1);
  expect(tutorial.step()).toBe("aim");
  store.changeElevation(-1);
  expect(tutorial.step()).toBe("move");
});

it("移動は左右の両方をしたときだけ進む。歩数が尽きても向きを変えれば数える", () => {
  const store = tutorialStore();
  const tutorial = guide(store, "move");
  for (let i = 0; i < 40; i++) store.moveStep(1);
  expect(store.getView().control!.stepsLeft).toBe(0);
  store.changeElevation(5);
  expect(tutorial.step()).toBe("move");
  store.moveStep(-1);
  expect(store.getView().control!.x).toBe(TUTORIAL_STAGE.start[0] + 30);
  expect(tutorial.step()).toBe("weapon");
});

it("武器、発射、目安の線、的の順に、促した操作でだけ進む。的は的当ての手順で初めて出る", () => {
  const store = tutorialStore();
  const tutorial = guide(store, "weapon");
  expect(store.getTargets()).toEqual([]);
  store.changeElevation(3);
  expect(tutorial.step()).toBe("weapon");
  store.selectSlot(1);
  expect(tutorial.step()).toBe("fire");
  store.fire(100);
  expect(tutorial.step()).toBe("fire");
  replay(store);
  expect(tutorial.step()).toBe("memo");
  expect(store.getTargets()).toEqual([]);
  // 目安の線は盤面に残らないので、画面が目盛りを押したことを受けて進める
  tutorial.press();
  expect(tutorial.step()).toBe("target");
  expect(store.getTargets().map(t => [t.x, t.y])).toEqual([TUTORIAL_TARGET]);
  shoot(store, miss);
  expect(tutorial.step()).toBe("target");
  walkHome(store);
  shoot(store, TUTORIAL_SOLUTION);
  expect(tutorial.step()).toBe("wind");
});

it("風の手順で風が吹き始め、風の中で1発撃つと制限時間の説明へ進む", () => {
  const store = tutorialStore();
  const tutorial = guide(store, "wind");
  expect(store.getView().wind.value).toBe(TUTORIAL_WIND);
  store.fire(40);
  expect(store.getView().replay!.shot.input.wind).toBe(TUTORIAL_WIND);
  expect(tutorial.step()).toBe("wind");
  replay(store);
  expect(tutorial.step()).toBe("timer");
});

it("ダブルシュートの手順では新しい的が出て、ダブルシュートを使って撃ち終えたときだけ進む", () => {
  const store = tutorialStore();
  const tutorial = guide(store, "double");
  expect(store.getTargets().map(t => [t.x, t.y])).toEqual([TUTORIAL_TARGET, ITEM_TARGET]);
  shoot(store, miss);
  expect(tutorial.step()).toBe("double");
  store.selectItem("double");
  store.fire(40);
  // 生きた的があるので、ダブルシュートは 2 発目まで撃つ
  expect(store.getView().replay!.firstShot).toBeDefined();
  replay(store);
  expect(tutorial.step()).toBe("teleport");
});

it("テレポートの手順は、テレポートを使って移ったときだけ進む", () => {
  const store = tutorialStore();
  const tutorial = guide(store, "teleport");
  store.selectItem("double");
  store.fire(40);
  replay(store);
  expect(tutorial.step()).toBe("teleport");
  const before = store.getView().control!.x;
  store.selectItem("teleport");
  store.fire(50);
  replay(store);
  expect(store.getView().control!.x).not.toBe(before);
  expect(tutorial.step()).toBe("done");
});

it("アイテムの手順では、その手順のアイテムだけを押せる", () => {
  expect(tutorialItems("timer")).toEqual([]);
  expect(tutorialItems("double")).toEqual(["double"]);
  expect(tutorialItems("teleport")).toEqual(["teleport"]);
  expect(tutorialItems("done")).toEqual([]);
});

it("盤面の準備は手順から決まり、やり直しでストアを作り直してもかけ直せる", () => {
  expect(tutorialSetup("fire")).toEqual({ targets: [], wind: 0 });
  expect(tutorialSetup("target")).toEqual({ targets: [TUTORIAL_TARGET], wind: 0 });
  expect(tutorialSetup("timer")).toEqual({ targets: [TUTORIAL_TARGET], wind: TUTORIAL_WIND });
  expect(tutorialSetup("done")).toEqual({ targets: [TUTORIAL_TARGET, ITEM_TARGET], wind: TUTORIAL_WIND });
  const store = tutorialStore();
  guide(store, "double");
  expect(store.getTargets()).toHaveLength(2);
  expect(store.getView().wind.value).toBe(TUTORIAL_WIND);
});

it("チュートリアルの盤面は外し続けても、的をすべて壊しても終わらない", () => {
  const store = tutorialStore();
  store.addTargets([TUTORIAL_TARGET]);
  for (let i = 0; i < 20; i++) shoot(store, miss);
  expect(store.getState().status).toBe("playing");
  walkHome(store);
  shoot(store, TUTORIAL_SOLUTION);
  expect(store.getTargets().every(t => t.destroyed)).toBe(true);
  expect(store.getState().status).toBe("playing");
  expect(store.getView().phase).toBe("acting");
});
