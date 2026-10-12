import { startBlocker, type StartBlocker, type StartMember } from "@game/engine/start-blocker";
import type { RoomSnapshot } from "@game/protocol/v2-rooms";

// 部屋画面のドックに出す「次にすること」（設計書 45.4）。役割と人数で核が入れ替わる。
// 開始の判定はサーバーの startLobby と同じ startBlocker を使い、押せない理由を画面とサーバーで食い違わせない。

export type RoomStepRoom = { readonly mode: RoomSnapshot["mode"]; readonly ownerId: string | null; readonly members: readonly StartMember[] };
export type RoomStep =
  | { readonly kind: "spectate" }
  | { readonly kind: "invite" }
  | { readonly kind: "quick"; readonly ready: boolean; readonly count: number; readonly capacity: number }
  | { readonly kind: "start"; readonly blocker: StartBlocker | null; readonly waiting: number }
  | { readonly kind: "ready"; readonly ready: boolean; readonly blocker: StartBlocker | null; readonly waiting: number };
/** 色の意味（45.5）。normal は主文、wait は未完了・待ち、danger は切断・エラー */
export type RoomTone = "normal" | "wait" | "danger";
export type RoomStepMessage = { readonly key: string; readonly values?: Readonly<Record<string, number>>; readonly tone: RoomTone };

export const roomStep = (room: RoomStepRoom, playerId: string, spectator: boolean): RoomStep => {
  const me = room.members.find(p => p.playerId === playerId);
  if (spectator || !me) return { kind: "spectate" };
  if (room.mode !== "custom") return { kind: "quick", ready: me.ready, count: room.members.length, capacity: room.mode === "1v1" ? 2 : 4 };
  const blocker = startBlocker(room.members, room.ownerId, false);
  if (blocker === "not-enough-players") return { kind: "invite" };
  const waiting = room.members.filter(p => !p.ready && p.playerId !== room.ownerId).length;
  return room.ownerId === playerId ? { kind: "start", blocker, waiting } : { kind: "ready", ready: me.ready, blocker, waiting };
};

const blockerMessage = (blocker: Exclude<StartBlocker, "not-ready">): RoomStepMessage => ({
  "not-enough-players": { key: "相手に部屋コードか招待リンクを送ってください。", tone: "normal" },
  disconnected: { key: "切断中の参加者の復帰を待っています。", tone: "danger" },
  unassigned: { key: "チームが決まっていない参加者がいます。", tone: "wait" },
  "not-enough-teams": { key: "全員が同じチームです。2チーム以上に分けてください。", tone: "wait" },
} as const)[blocker];

export const roomStepMessage = (step: RoomStep): RoomStepMessage => {
  if (step.kind === "spectate") return { key: "観戦中です。対戦が始まると、ここから観戦できます。", tone: "normal" };
  if (step.kind === "invite") return blockerMessage("not-enough-players");
  if (step.kind === "quick") return step.ready
    ? { key: "対戦相手を待っています（{count}/{capacity}人）。", values: { count: step.count, capacity: step.capacity }, tone: "wait" }
    : { key: "準備完了を押すと、人数がそろったときに自動で始まります。", tone: "normal" };
  if (step.kind === "ready" && !step.ready) return { key: "武器とチームを確かめて、準備完了を押してください。", tone: "normal" };
  if (step.blocker === null) return step.kind === "start"
    ? { key: "全員そろいました。対戦を始められます。", tone: "normal" }
    : { key: "オーナーが対戦を始めるのを待っています。", tone: "normal" };
  if (step.blocker !== "not-ready") return blockerMessage(step.blocker);
  return step.kind === "start"
    ? { key: "{count}人の準備完了を待っています。", values: { count: step.waiting }, tone: "wait" }
    : { key: "ほかの{count}人の準備完了を待っています。", values: { count: step.waiting }, tone: "wait" };
};

export type MemberState = { readonly key: string; readonly tone: RoomTone; readonly icon: "crown" | "check" | null };
/** 一覧の行に出す状態。切断を最初に知らせる。オーナーは準備完了を持たない（9.5、45.7） */
export const memberState = (member: StartMember, ownerId: string | null): MemberState => {
  if (!member.connected) return { key: "切断中", tone: "danger", icon: null };
  if (member.playerId === ownerId) return { key: "オーナー", tone: "normal", icon: "crown" };
  return member.ready ? { key: "準備完了", tone: "normal", icon: "check" } : { key: "準備中", tone: "wait", icon: null };
};

export const READY_RESET_MESSAGE = "参加者か部屋の設定が変わったので、準備完了が解除されました。";
/** マップや編成の変更で準備完了が外れたか。自分で解除した（requested が false）ときは知らせない */
export const readyWasReset = (previous: boolean | undefined, next: boolean | undefined, requested: boolean | null): boolean =>
  previous === true && next === false && requested !== false;
