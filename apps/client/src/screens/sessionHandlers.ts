import type { RoomClosedReason, RoomErrorReason, ServerMessage, ServerMessageOf } from "@game/protocol";
import type { Profile } from "@/app/profile";
import type { MatchStore } from "@/match/matchStore";
import type { Connection } from "@/net/connection";
import type { LobbyQueryState } from "./LobbyScreen";

// useOnlineSession から切り出した、接続の開始時とサーバーのメッセージ受信時の処理。

export type RoomSession = {
  readonly code: string;
  readonly seat: 0 | 1 | null;
  readonly spectator: boolean;
  readonly token: string;
  readonly room: ServerMessageOf<"room.joined">["room"];
};

export type SessionContext = {
  readonly conn: Connection;
  readonly matchStore: MatchStore;
  readonly query: () => LobbyQueryState;
  readonly profile: () => Profile;
  readonly hasSession: () => boolean;
  readonly setPage: (page: ServerMessageOf<"lobby.page">) => void;
  readonly setSession: (update: (s: RoomSession | null) => RoomSession | null) => void;
  readonly setError: (error: string | null) => void;
  readonly setClosedReason: (reason: string | null) => void;
  readonly readToken: () => string | null;
  readonly writeToken: (token: string | null) => void;
};

const ERRORS: Readonly<Record<RoomErrorReason, string>> = {
  notFound: "部屋が見つかりません",
  full: "満室です",
  inMatch: "対戦中です",
  notOwner: "オーナーだけができる操作です",
  notReady: "開始条件を満たしていません",
  colorConflict: "主色が重なっています。別の色を選んでください",
  spectatorsFull: "観戦者が上限に達しています",
  seatTaken: "席が空いていません",
  notMember: "参加者ではありません",
  badRequest: "受け付けられない操作です",
  invalidToken: "再接続できませんでした",
};

const CLOSED: Readonly<Record<RoomClosedReason, string>> = {
  kicked: "部屋から退室させられました",
  idle: "部屋が放置により閉じられました",
  dissolved: "部屋が解散されました",
};

export const enterLobby = (ctx: SessionContext): void => {
  ctx.conn.send({ type: "lobby.subscribe" });
  ctx.conn.send({ type: "lobby.query", ...ctx.query() });
};

/** 接続が開いたとき。トークンがあれば席を取り戻し、招待コードがあれば入室し、どちらもなければロビーに立つ */
export const onConnectionOpen = (ctx: SessionContext, inviteCode: string | null): void => {
  const token = ctx.readToken();
  if (token) {
    ctx.conn.send({ type: "conn.resume", token });
    return;
  }
  if (inviteCode) {
    const p = ctx.profile();
    ctx.conn.send({ type: "room.join", code: inviteCode, playerId: p.playerId, nickname: p.nickname, colors: p.colors });
    return;
  }
  enterLobby(ctx);
};

export const handleServerMessage = (ctx: SessionContext, m: ServerMessage): void => {
  switch (m.type) {
    case "lobby.page":
      ctx.setPage(m);
      return;
    case "lobby.changed":
      ctx.conn.send({ type: "lobby.query", ...ctx.query() });
      return;
    case "room.joined":
      ctx.writeToken(m.token);
      ctx.setError(null);
      ctx.setClosedReason(null);
      ctx.conn.send({ type: "lobby.unsubscribe" });
      ctx.matchStore.setSeat(m.seat, m.spectator);
      ctx.setSession(() => ({ code: m.code, seat: m.seat, spectator: m.spectator, token: m.token, room: m.room }));
      return;
    case "room.state":
      // 席は room.joined でだけ決まる。キックは room.closed、席の移動は新しい room.joined で届く
      ctx.setSession((s) => (s ? { ...s, room: m.room } : s));
      return;
    case "room.closed":
      ctx.writeToken(null);
      ctx.setSession(() => null);
      ctx.setClosedReason(CLOSED[m.reason]);
      enterLobby(ctx);
      return;
    case "room.error":
      if (m.reason === "invalidToken") ctx.writeToken(null);
      else ctx.setError(ERRORS[m.reason]);
      // 部屋に入れなかったらロビーに立つ。招待リンクや再接続の失敗もここに来る
      if (!ctx.hasSession()) enterLobby(ctx);
      return;
    default:
      return;
  }
};
