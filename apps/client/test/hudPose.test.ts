import { expect, it } from "vitest";
import { hudPose } from "../src/match/hudPose";
import { EMPTY_VIEW, type MatchView, type ReplayJob } from "../src/match/types";

// HUD の角度と傾きに使う自機の位置と向き。手番の操作、射撃の再生、それ以外の確定した位置の順に選ぶ
const players: MatchView["players"] = [
  { seat: 0, nickname: "P", colors: { primary: "red", secondary: "yellow" }, loadout: ["cannon", "digger"], x: 60, y: 150, hp: 100, facing: -1, connected: true },
  { seat: 1, nickname: "CPU", colors: { primary: "cyan", secondary: "blue" }, loadout: ["cannon", "triple"], x: 300, y: 150, hp: 100, facing: -1, connected: true },
];
const view: MatchView = { ...EMPTY_VIEW, phase: "waiting", mySeat: 0, currentSeat: 1, players };
const replayOf = (seat: 0 | 1): ReplayJob => ({ id: 1, shot: { input: { seat, weapon: "cannon", x: 64, y: 149, facing: 1, elevation: 45, power: 50, wind: 0 }, impacts: [], hpAfter: [100, 100], xAfter: [64, 300], yAfter: [149, 150], ringOut: [], finished: null },
  paths: [], maskBefore: { width: 1, height: 1, cells: new Uint8Array(1) }, maskAfter: { width: 1, height: 1, cells: new Uint8Array(1) }, playersBefore: players!, playersAfter: players! });

it("手番中は操作中の位置と向き", () => {
  const acting: MatchView = { ...view, phase: "acting", currentSeat: 0, control: { x: 62, y: 150, facing: 1, elevation: 45, slot: 0, item: null, stepsLeft: 28, fell: false } };
  expect(hudPose(acting, 0)).toEqual({ x: 62, y: 150, facing: 1 });
});

it("自分の射撃の再生中は、手番の初めの向きに戻さず撃った位置と向き", () => {
  expect(hudPose({ ...view, phase: "replaying", currentSeat: 0, replay: replayOf(0) }, 0)).toEqual({ x: 64, y: 149, facing: 1 });
});

it("相手の射撃の再生中と相手の手番は、確定した位置と向き", () => {
  expect(hudPose({ ...view, phase: "replaying", replay: replayOf(1) }, 0)).toEqual({ x: 60, y: 150, facing: -1 });
  expect(hudPose(view, 0)).toEqual({ x: 60, y: 150, facing: -1 });
});

it("相手の手番と相手の射撃の再生中は、準備した向き", () => {
  expect(hudPose({ ...view, preparedFacing: 1 }, 0)).toEqual({ x: 60, y: 150, facing: 1 });
  expect(hudPose({ ...view, phase: "replaying", replay: replayOf(1), preparedFacing: 1 }, 0)).toEqual({ x: 60, y: 150, facing: 1 });
});

it("機体がまだ無ければ null", () => {
  expect(hudPose(EMPTY_VIEW, 0)).toBeNull();
});
