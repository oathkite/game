import type { RoomState, RoomReply } from "./core.js";
export const REPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export type PlayerReport = { readonly matchId: string; readonly reporterId: string; readonly targetId: string; readonly reason: "name" | "abuse" | "cheating"; readonly createdAt: number; readonly targetName: string; readonly turnId: number; readonly eventSeq: number };
export const reportPlayer = (state: RoomState, reporterId: string, message: { readonly matchId: string; readonly targetId: string; readonly reason: PlayerReport["reason"] }, now: number): RoomReply => {
  if (!state.battle || state.battle.matchId !== message.matchId) return { state, reason: "wrong-turn" };
  if (message.targetId === reporterId || !state.battle.roster.members.some(p => p.playerId === message.targetId)) return { state, reason: "invalid-report-target" };
  const reports = state.reports.filter(report => now < report.createdAt + REPORT_RETENTION_MS);
  if (reports.some(report => report.matchId === message.matchId && report.reporterId === reporterId && report.targetId === message.targetId)) return { state, reason: "accepted", reported: "duplicate" };
  if (reports.length >= 256) return { state, reason: "report-capacity" };
  return { state: { ...state, reports: [...reports, { matchId: message.matchId, targetId: message.targetId, reason: message.reason, reporterId, createdAt: now, targetName: state.lobby?.members.find(p => p.playerId === message.targetId)?.nickname ?? message.targetId, turnId: state.battle.roster.turnId, eventSeq: state.battle.movement.eventSeq }] }, reason: "accepted", reported: "saved" };
};
