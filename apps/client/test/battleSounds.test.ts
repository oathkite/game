import { expect, it } from "vitest";
import { createBattleSounds, type SoundFrame } from "../src/networkLab/battleSounds";
// 着弾ありダメージなしは飛翔の終わりから 1000 ms 留める（設計書 41.8）。endsAt 3000 の飛翔は 1000 から 2000
const acting: SoundFrame = { matchId: "m", turnId: 1, phase: "acting", replay: null };
const shot: SoundFrame = { ...acting, phase: "replaying", replay: { startsAt: 1000, endsAt: 3000, ticks: 60, paths: [{ launchTick: 0 }, { launchTick: 30 }], impacts: [{ tick: 60, damage: [] }] } };
it("plays timed launches and impacts once, then the next turn", () => {
  const sounds = createBattleSounds();
  expect(sounds(acting, 900)).toEqual([]);
  expect(sounds(shot, 1000)).toEqual(["fire"]);
  expect(sounds(shot, 1000)).toEqual([]);
  expect(sounds(shot, 1500)).toEqual(["fire"]);
  expect(sounds(shot, 2000)).toEqual(["explosion", "debris", "sizzle"]);
  // 最後の着弾の削る瞬間（着弾から 190 ms）に止めの一撃（設計書 41.14）
  expect(sounds(shot, 2300)).toEqual(["impactStop"]);
  expect(sounds(shot, 2700)).toEqual([]);
  expect(sounds({ ...acting, turnId: 2 }, 3100)).toEqual(["tick"]);
});
it("joining or reconnecting during replay never replays past sounds", () => {
  const sounds = createBattleSounds();
  expect(sounds(shot, 1600)).toEqual([]);
  expect(sounds(shot, 2000)).toEqual(["explosion", "debris", "sizzle"]);
  expect(sounds({ ...shot, matchId: "new" }, 2100)).toEqual([]);
});
it("coalesces simultaneous effects and drops catch-up audio after background suspension", () => {
  const sounds = createBattleSounds(); sounds(acting, 900);
  expect(sounds({ ...shot, replay: { ...shot.replay!, paths: [{ launchTick: 0 }, { launchTick: 0 }] } }, 1000)).toEqual(["fire"]);
  expect(sounds(shot, 2200)).toEqual([]);
  expect(sounds({ ...acting, phase: "finished" }, 2300)).toEqual(["finish"]);
  expect(sounds({ ...acting, phase: "finished" }, 2400)).toEqual([]);
});

it("accepts a slightly late shot frame but does not repeat events when the clock corrects backward", () => {
  const sounds = createBattleSounds(); sounds(acting, 1050);
  expect(sounds(shot, 1100)).toEqual(["fire"]);
  expect(sounds(shot, 1500)).toEqual(["fire"]);
  expect(sounds(shot, 1400)).toEqual([]);
  expect(sounds(shot, 1500)).toEqual([]);
});

it("uses distinct laser and floater sounds on the same timeline", () => {
  for (const weapon of ["laser", "floater"] as const) {
    const sounds = createBattleSounds(); sounds(acting, 900);
    const frame = { ...shot, replay: { ...shot.replay!, shooter: { weapon } } };
    expect(sounds(frame, 1000)).toEqual([`${weapon}-fire`]);
    sounds(frame, 1500);
    expect(sounds(frame, 2000)).toEqual([`${weapon}-impact`, "debris", "sizzle"]);
  }
});

it("plays the wreck bursts when an impact takes a tank to zero HP, after the HP bar drains (設計書 41.14)", () => {
  // ダメージありは飛翔の終わりから 1600 ms 留めるので、endsAt 3600 の飛翔は 1000 から 2000
  const lethal: SoundFrame = { ...shot, replay: { ...shot.replay!, endsAt: 3600, impacts: [{ tick: 60, damage: [{ playerId: "p1", amount: 100 }] }], playersBefore: [{ playerId: "p1", hp: 100, eliminated: false }] } };
  const sounds = createBattleSounds(); sounds(acting, 900);
  sounds(lethal, 1000); sounds(lethal, 1400); sounds(lethal, 1800);
  expect(sounds(lethal, 2000)).toContain("hit");
  // 削る瞬間 190 ms、HP バーが減りきる 400 ms、明滅が終わる 260 ms の後（着弾から 850 ms）
  expect(sounds(lethal, 2400)).not.toContain("destroy");
  expect(sounds(lethal, 2800)).not.toContain("destroy");
  expect(sounds(lethal, 3200)).toContain("destroy");
});
it("does not play the finishing stop while another shell is still flying", () => {
  const staggered: SoundFrame = { ...shot, replay: { ...shot.replay!, paths: [{ launchTick: 0, endTick: 30 }, { launchTick: 30, endTick: 60 }], impacts: [{ tick: 30, damage: [] }, { tick: 50, damage: [] }] } };
  const sounds = createBattleSounds(); sounds(acting, 900);
  const heard = [1000, 1400, 1800, 2200, 2600].flatMap((t) => sounds(staggered, t));
  expect(heard).not.toContain("impactStop");
});
