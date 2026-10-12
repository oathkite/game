import { expect, it } from "vitest";
import { startBlocker, type StartMember } from "../src/multiplayer/startBlocker";

// 開始を止める最初の理由。サーバーの startLobby と部屋画面の「次にすること」が同じ判定を使う（設計書 45.4）

const member = (playerId: string, teamId: string | null, patch: Partial<StartMember> = {}): StartMember =>
  ({ playerId, teamId, connected: true, ready: true, ...patch });

it("2 人以上、全員接続、全員配置、2 チーム以上、全員準備完了なら止めない", () => {
  expect(startBlocker([member("a", "t0"), member("b", "t1")], "a", true)).toBeNull();
});

it("1 人だけ、または空の部屋は人数不足", () => {
  expect(startBlocker([], null, true)).toBe("not-enough-players");
  expect(startBlocker([member("a", "t0")], "a", true)).toBe("not-enough-players");
});

it("理由はサーバーと同じ順で 1 つだけ返す", () => {
  const all = [member("a", "t0", { ready: false }), member("b", null, { connected: false })];
  expect(startBlocker(all, "a", true)).toBe("disconnected");
  expect(startBlocker([member("a", "t0", { ready: false }), member("b", null)], "a", true)).toBe("unassigned");
  expect(startBlocker([member("a", "t0", { ready: false }), member("b", "t0")], "a", true)).toBe("not-enough-teams");
  expect(startBlocker([member("a", "t0"), member("b", "t1", { ready: false })], "a", true)).toBe("not-ready");
});

it("カスタム部屋ではオーナーの準備完了を求めない", () => {
  const room = [member("a", "t0", { ready: false }), member("b", "t1")];
  expect(startBlocker(room, "a", false)).toBeNull();
  expect(startBlocker(room, "a", true)).toBe("not-ready");
  expect(startBlocker([member("a", "t0"), member("b", "t1", { ready: false })], "a", false)).toBe("not-ready");
});
