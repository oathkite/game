import { expect, it } from "vitest";
import { createBattleSounds, type SoundFrame } from "../src/networkLab/battleSounds";
const acting: SoundFrame = { matchId: "m", turnId: 1, phase: "acting", replay: null };
const shot: SoundFrame = { ...acting, phase: "replaying", replay: { startsAt: 1000, endsAt: 2300, ticks: 60, paths: [{ launchTick: 0 }, { launchTick: 30 }], impacts: [{ tick: 60, damage: [] }] } };
it("plays timed launches and impacts once, then the next turn", () => {
  const sounds = createBattleSounds();
  expect(sounds(acting, 900)).toEqual([]);
  expect(sounds(shot, 1000)).toEqual(["fire"]);
  expect(sounds(shot, 1000)).toEqual([]);
  expect(sounds(shot, 1500)).toEqual(["fire"]);
  expect(sounds(shot, 2000)).toEqual(["explosion"]);
  expect(sounds({ ...acting, turnId: 2 }, 2400)).toEqual(["tick"]);
});
it("joining or reconnecting during replay never replays past sounds", () => {
  const sounds = createBattleSounds();
  expect(sounds(shot, 1600)).toEqual([]);
  expect(sounds(shot, 2000)).toEqual(["explosion"]);
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
