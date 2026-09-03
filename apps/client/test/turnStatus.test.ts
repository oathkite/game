import { describe, expect, it } from "vitest";
import { EMPTY_VIEW, type MatchView, type PlayerView } from "@/match/types";
import { shouldAnnounceTurn, turnStatus } from "@/ui/turnStatus";

// 手番の表示。自分の番だけ明るく、相手の番と再生中は暗く出す。

const player = (seat: 0 | 1, nickname: string): PlayerView => ({
  seat,
  nickname,
  colors: { primary: "red", secondary: "red" },
  hp: 100,
  x: 100,
  facing: 1,
  connected: true,
});

const base: MatchView = { ...EMPTY_VIEW, players: [player(0, "alice"), player(1, "bob")], mySeat: 0, deadlineAt: 5000 };

describe("turnStatus", () => {
  it("読み込み中と決着後は出さない", () => {
    expect(turnStatus({ ...base, phase: "idle" })).toBeNull();
    expect(turnStatus({ ...base, phase: "loading" })).toBeNull();
    expect(turnStatus({ ...base, phase: "finished" })).toBeNull();
  });

  it("自分の手番は明るく、射撃を送った後も自分の番のまま", () => {
    expect(turnStatus({ ...base, phase: "acting", currentSeat: 0 })).toEqual({ kind: "mine", label: "あなたの番", bright: true });
    expect(turnStatus({ ...base, phase: "fired", currentSeat: 0 })?.kind).toBe("mine");
  });

  it("相手の手番は暗く出す", () => {
    expect(turnStatus({ ...base, phase: "waiting", currentSeat: 1 })).toEqual({ kind: "theirs", label: "相手の番", bright: false });
  });

  it("再生中は再生中と出す", () => {
    expect(turnStatus({ ...base, phase: "replaying", deadlineAt: null })?.label).toBe("再生中");
  });

  it("パスの直後は自分の席のままでも「あなたの番」を残さない", () => {
    const s = turnStatus({ ...base, phase: "waiting", currentSeat: 0, deadlineAt: null });
    expect(s?.kind).toBe("between");
    expect(s?.bright).toBe(false);
  });

  it("観戦者には手番側の名前を出す", () => {
    const s = turnStatus({ ...base, phase: "waiting", spectator: true, mySeat: null, currentSeat: 1 });
    expect(s).toEqual({ kind: "theirs", label: "bob の番", bright: false });
  });

  it("ラベルにターン数を含めない", () => {
    expect(turnStatus({ ...base, phase: "acting", turnNumber: 7 })?.label).not.toMatch(/7/);
  });
});

describe("shouldAnnounceTurn", () => {
  it("制限時間が動き始めた手番だけ告知する", () => {
    expect(shouldAnnounceTurn({ ...base, phase: "acting" })).toBe(true);
    expect(shouldAnnounceTurn({ ...base, phase: "waiting", currentSeat: 1 })).toBe(true);
    expect(shouldAnnounceTurn({ ...base, phase: "waiting", deadlineAt: null })).toBe(false);
    expect(shouldAnnounceTurn({ ...base, phase: "replaying", deadlineAt: null })).toBe(false);
    expect(shouldAnnounceTurn({ ...base, phase: "loading" })).toBe(false);
  });

  // 撃つと deadlineAt を残したまま phase だけ fired になる。ここで false を返さないと
  // バナーが結果の到着まで出続ける
  it("射撃を送った後は告知しない", () => {
    expect(shouldAnnounceTurn({ ...base, phase: "fired", currentSeat: 0 })).toBe(false);
  });
});
