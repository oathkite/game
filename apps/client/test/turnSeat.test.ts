import { expect, it } from "vitest";
import { turnSeatOf } from "@/match/turnSeat";
import { EMPTY_VIEW, type MatchView } from "@/match/types";

const view = (over: Partial<MatchView>): MatchView => ({ ...EMPTY_VIEW, currentSeat: 1, deadlineAt: 20_000, ...over });

it("自分の手番でも相手の手番でも、残り時間が動いている間は手番の席を返す", () => {
  expect(turnSeatOf(view({ phase: "acting", currentSeat: 0 }))).toBe(0);
  // 相手の手番は、自分の画面では waiting になる
  expect(turnSeatOf(view({ phase: "waiting", currentSeat: 1 }))).toBe(1);
});

it("パスや再生の後で次のターンを待っている間は、どの席も手番にしない", () => {
  expect(turnSeatOf(view({ phase: "waiting", deadlineAt: null }))).toBeNull();
  expect(turnSeatOf(view({ phase: "replaying" }))).toBeNull();
  expect(turnSeatOf(view({ phase: "fired" }))).toBeNull();
  expect(turnSeatOf(view({ phase: "finished" }))).toBeNull();
  expect(turnSeatOf(view({ phase: "loading" }))).toBeNull();
  expect(turnSeatOf(EMPTY_VIEW)).toBeNull();
});
