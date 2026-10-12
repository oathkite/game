import { expect, it } from "vitest";
import { english } from "@/i18n/messages";
import { memberState, READY_RESET_MESSAGE, readyWasReset, roomStep, roomStepMessage, type RoomStepRoom } from "@/worldUi/roomStep";

// 部屋画面のドックに出す「次にすること」。役割と人数で核が入れ替わる（設計書 45.1、45.4）

type Member = RoomStepRoom["members"][number];
const member = (playerId: string, teamId: string | null, patch: Partial<Member> = {}): Member =>
  ({ playerId, teamId, connected: true, ready: false, ...patch });
const custom = (members: readonly Member[], ownerId = "a"): RoomStepRoom => ({ mode: "custom", ownerId, members });

it("1 人の部屋では、オーナーに招待させる", () => {
  const step = roomStep(custom([member("a", "t0")]), "a", false);
  expect(step).toEqual({ kind: "invite" });
  expect(roomStepMessage(step)).toEqual({ key: "相手に部屋コードか招待リンクを送ってください。", tone: "normal" });
});

it("オーナーは、準備完了していない人数を待つ。オーナー自身は数えない", () => {
  const step = roomStep(custom([member("a", "t0"), member("b", "t1"), member("c", "t2", { ready: true })]), "a", false);
  expect(step).toEqual({ kind: "start", blocker: "not-ready", waiting: 1 });
  expect(roomStepMessage(step)).toEqual({ key: "{count}人の準備完了を待っています。", values: { count: 1 }, tone: "wait" });
});

it("全員そろったら、オーナーに開始を促す", () => {
  const step = roomStep(custom([member("a", "t0"), member("b", "t1", { ready: true })]), "a", false);
  expect(step).toEqual({ kind: "start", blocker: null, waiting: 0 });
  expect(roomStepMessage(step).key).toBe("全員そろいました。対戦を始められます。");
});

it("切断と同じチームは、待つ人数より先に理由を出す", () => {
  const away = roomStep(custom([member("a", "t0"), member("b", "t1", { connected: false })]), "a", false);
  expect(roomStepMessage(away)).toEqual({ key: "切断中の参加者の復帰を待っています。", tone: "danger" });
  const same = roomStep(custom([member("a", "t0"), member("b", "t0")]), "a", false);
  expect(roomStepMessage(same)).toEqual({ key: "全員が同じチームです。2チーム以上に分けてください。", tone: "wait" });
  const unassigned = roomStep(custom([member("a", "t0"), member("b", null, { ready: true })]), "b", false);
  expect(roomStepMessage(unassigned)).toEqual({ key: "チームが決まっていない参加者がいます。", tone: "wait" });
});

it("参加者は、自分が準備完了かどうかで次にすることが変わる", () => {
  const before = roomStep(custom([member("a", "t0"), member("b", "t1")]), "b", false);
  expect(before).toEqual({ kind: "ready", ready: false, blocker: "not-ready", waiting: 1 });
  expect(roomStepMessage(before).key).toBe("武器とチームを確かめて、準備完了を押してください。");
  const after = roomStep(custom([member("a", "t0"), member("b", "t1", { ready: true })]), "b", false);
  expect(roomStepMessage(after).key).toBe("オーナーが対戦を始めるのを待っています。");
  const others = roomStep(custom([member("a", "t0"), member("b", "t1", { ready: true }), member("c", "t2")]), "b", false);
  expect(roomStepMessage(others)).toEqual({ key: "ほかの{count}人の準備完了を待っています。", values: { count: 1 }, tone: "wait" });
});

it("観戦者は操作を持たない", () => {
  const step = roomStep(custom([member("a", "t0"), member("b", "t1")]), "viewer", true);
  expect(step).toEqual({ kind: "spectate" });
  expect(roomStepMessage(step).tone).toBe("normal");
});

it("クイック参加は人数がそろうと自動で始まるので、開始の操作を持たない", () => {
  const room: RoomStepRoom = { mode: "2v2", ownerId: null, members: [member("a", "t0", { ready: true }), member("b", "t1")] };
  expect(roomStep(room, "a", false)).toEqual({ kind: "quick", ready: true, count: 2, capacity: 4 });
  expect(roomStepMessage(roomStep(room, "b", false)).key).toBe("準備完了を押すと、人数がそろったときに自動で始まります。");
  expect(roomStepMessage(roomStep(room, "a", false))).toEqual({ key: "対戦相手を待っています（{count}/{capacity}人）。", values: { count: 2, capacity: 4 }, tone: "wait" });
});

it("部屋にまだ自分がいない間は、観戦者と同じく操作を持たない", () => {
  expect(roomStep(custom([member("a", "t0")]), "", false)).toEqual({ kind: "spectate" });
});

it("参加者の状態は、文字とアイコンと色の意味を組にして返す", () => {
  expect(memberState(member("a", "t0"), "a")).toEqual({ key: "オーナー", tone: "normal", icon: "crown" });
  expect(memberState(member("b", "t1", { ready: true }), "a")).toEqual({ key: "準備完了", tone: "normal", icon: "check" });
  expect(memberState(member("b", "t1"), "a")).toEqual({ key: "準備中", tone: "wait", icon: null });
  // 切断は準備完了やオーナーより先に知らせる
  expect(memberState(member("a", "t0", { connected: false, ready: true }), "a")).toEqual({ key: "切断中", tone: "danger", icon: null });
});

it("自分で解除していないのに準備完了が外れたら、知らせる", () => {
  expect(readyWasReset(true, false, null)).toBe(true);
  expect(readyWasReset(true, false, false)).toBe(false);
  expect(readyWasReset(false, false, null)).toBe(false);
  expect(readyWasReset(undefined, false, null)).toBe(false);
  expect(readyWasReset(true, true, null)).toBe(false);
});

it("次にすることの文言は、すべて英語の訳を持つ", () => {
  const rooms: RoomStepRoom[] = [
    custom([member("a", "t0")]), custom([member("a", "t0"), member("b", "t1")]), custom([member("a", "t0"), member("b", "t1", { ready: true })]),
    custom([member("a", "t0"), member("b", "t0")]), custom([member("a", "t0"), member("b", null)]), custom([member("a", "t0"), member("b", "t1", { connected: false })]),
    custom([member("a", "t0"), member("b", "t1", { ready: true }), member("c", "t2")]),
    { mode: "1v1", ownerId: null, members: [member("a", "t0"), member("b", "t1", { ready: true })] },
  ];
  const keys = rooms.flatMap(room => ["a", "b", "c"].flatMap(id => [roomStep(room, id, false), roomStep(room, id, true)])).map(step => roomStepMessage(step).key);
  const states = [member("a", "t0"), member("b", "t1", { ready: true }), member("c", "t2"), member("d", "t3", { connected: false })].map(p => memberState(p, "a").key);
  expect([...new Set([...keys, ...states, READY_RESET_MESSAGE])].filter(key => !Object.hasOwn(english, key))).toEqual([]);
});
