// 部屋の開始を止める理由。サーバーの startLobby と、部屋画面の「次にすること」（設計書 45.4）が同じ判定を使う。
// クライアントからも読むので、マップや乱数を扱うモジュールを import しない。

export type StartMember = { readonly playerId: string; readonly teamId: string | null; readonly connected: boolean; readonly ready: boolean };
export type StartBlocker = "not-enough-players" | "disconnected" | "unassigned" | "not-enough-teams" | "not-ready";

/** 最初に当たる理由を返す。開始できるなら null。requireOwnerReady が false ならオーナーの準備完了を求めない（カスタム部屋） */
export const startBlocker = (members: readonly StartMember[], ownerId: string | null, requireOwnerReady: boolean): StartBlocker | null => {
  if (members.length < 2) return "not-enough-players";
  if (members.some(p => !p.connected)) return "disconnected";
  if (members.some(p => p.teamId === null)) return "unassigned";
  if (new Set(members.map(p => p.teamId)).size < 2) return "not-enough-teams";
  if (members.some(p => !p.ready && (requireOwnerReady || p.playerId !== ownerId))) return "not-ready";
  return null;
};
