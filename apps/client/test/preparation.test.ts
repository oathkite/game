import { reduce } from "../src/match/reduce";
import { expect, it } from "vitest";
import { applyElevation, applyFacing, applySlot, applyStep } from "../src/match/control";
import { EMPTY_VIEW, type MatchView } from "../src/match/types";
const waiting: MatchView = { ...EMPTY_VIEW, phase: "waiting", mySeat: 0, currentSeat: 1, players: [
  { seat: 0, nickname: "P", colors: { primary: "red", secondary: "yellow" }, loadout: ["cannon", "digger"], x: 60, y: 150, hp: 100, facing: 1, connected: true },
  { seat: 1, nickname: "CPU", colors: { primary: "cyan", secondary: "blue" }, loadout: ["cannon", "triple"], x: 300, y: 150, hp: 100, facing: -1, connected: true },
] };
it("敵の手番中は射角と武器を準備できるが移動はできない", () => {
  const aimed = applyElevation(waiting, 10, true);
  const equipped = applySlot(aimed, 1, true);
  expect(equipped.lastElevation).toBe(55);
  expect(equipped.lastSlot).toBe(1);
  expect(equipped.control).toBeNull();
  expect(equipped.players).toBe(waiting.players);
  expect(applyStep(equipped, 1)).toBe(equipped);
});
it("敵の射撃中も準備でき、決着後・観戦・自分の射撃中にはできない", () => {
  expect(applySlot({ ...waiting, phase: "replaying" }, 1, true).lastSlot).toBe(1);
  for (const view of [{ ...waiting, phase: "finished" as const }, { ...waiting, spectator: true }, { ...waiting, phase: "replaying" as const, currentSeat: 0 as const }]) {
    expect(applySlot(view, 1, true)).toBe(view);
    expect(applyElevation(view, 10, true)).toBe(view);
  }
  expect(applySlot(waiting, 1)).toBe(waiting);
});


it("準備した武器と角度を次の自分の手番へ引き継ぐ", () => {
  const prepared = applySlot(applyElevation(waiting, 15, true), 1, true);
  const next = reduce(prepared, { type: "turn.start", turnNumber: 2, seat: 0, wind: { value: 0 }, deadlineAt: 10000 }, { mySeat: 0, followCurrentSeat: false, spectator: false, preparation: true }, 1);
  expect(next.view.control).toMatchObject({ elevation: 60, slot: 1, stepsLeft: 30 });
});

it("敵の手番中は向きだけを準備でき、位置は動かさず、次の自分の手番の初めの向きにする", () => {
  const turned = applyFacing(waiting, -1, true);
  expect(turned.preparedFacing).toBe(-1);
  expect(turned.players).toBe(waiting.players);
  expect(applyFacing({ ...waiting, phase: "replaying" }, -1, true).preparedFacing).toBe(-1);
  const next = reduce(turned, { type: "turn.start", turnNumber: 2, seat: 0, wind: { value: 0 }, deadlineAt: 10000 }, { mySeat: 0, followCurrentSeat: false, spectator: false, preparation: true }, 1);
  expect(next.view.control).toMatchObject({ x: 60, facing: -1, stepsLeft: 30 });
  expect(next.view.preparedFacing).toBeNull();
});

it("向きの準備は、準備できないときと準備のない対戦では何もしない", () => {
  for (const view of [{ ...waiting, phase: "finished" as const }, { ...waiting, spectator: true }, { ...waiting, phase: "replaying" as const, currentSeat: 0 as const }]) {
    expect(applyFacing(view, -1, true)).toBe(view);
  }
  expect(applyFacing(waiting, -1)).toBe(waiting);
  // 準備しなければ、手番は前の手番の向きで始める
  const next = reduce(waiting, { type: "turn.start", turnNumber: 2, seat: 0, wind: { value: 0 }, deadlineAt: 10000 }, { mySeat: 0, followCurrentSeat: false, spectator: false, preparation: true }, 1);
  expect(next.view.control?.facing).toBe(1);
});
