import type { MapName, RoomErrorReason, RoomState, Seat, ServerMessage, ServerMessageOf } from "@game/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { measureClockOffset } from "@/app/clockSync";
import type { Profile } from "@/app/profile";
import { createMatchStore, type MatchStore } from "@/match/matchStore";
import type { Connection } from "@/net/connection";
import { createWsConnection } from "@/net/wsConnection";
import type { LobbyQueryState } from "./LobbyScreen";

// オンライン対戦の接続と画面段階。接続とストアは effect の中で作り、StrictMode の二重マウントに耐える。

export type RoomSession = {
  readonly code: string;
  readonly seat: Seat | null;
  readonly spectator: boolean;
  readonly token: string;
  readonly room: RoomState;
};

const TOKEN_KEY = "fortress.session.v1";

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

const readToken = (): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const hasSessionToken = (): boolean => readToken() !== null;

const writeToken = (token: string | null): void => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // 保存できない環境では再接続を諦める
  }
};

export const useOnlineSession = (profile: Profile, inviteCode: string | null) => {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [store, setStore] = useState<MatchStore | null>(null);
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState<RoomSession | null>(null);
  const [page, setPage] = useState<ServerMessageOf<"lobby.page"> | null>(null);
  const [query, setQuery] = useState<LobbyQueryState>({ search: "", phase: "all", mapName: null, page: 0 });
  const [error, setError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const queryRef = useRef(query);
  queryRef.current = query;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const inviteUsed = useRef(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    const conn = createWsConnection();
    const matchStore = createMatchStore(conn, { followCurrentSeat: false, mySeat: null, spectator: false });
    setConnection(conn);
    setStore(matchStore);
    const unsubStatus = conn.onStatus((status) => {
      setConnected(status === "open");
      if (status !== "open") return;
      void measureClockOffset(conn).then((r) => setClockOffset(r.offset));
      const token = readToken();
      if (token) {
        conn.send({ type: "conn.resume", token });
      } else if (inviteCode && !inviteUsed.current) {
        inviteUsed.current = true;
        const p = profileRef.current;
        conn.send({ type: "room.join", code: inviteCode, playerId: p.playerId, nickname: p.nickname, colors: p.colors });
      } else {
        conn.send({ type: "lobby.subscribe" });
        conn.send({ type: "lobby.query", ...queryRef.current });
      }
    });
    const unsubMessage = conn.subscribe((m: ServerMessage) => {
      switch (m.type) {
        case "lobby.page":
          setPage(m);
          break;
        case "lobby.changed":
          conn.send({ type: "lobby.query", ...queryRef.current });
          break;
        case "room.joined":
          writeToken(m.token);
          setError(null);
          setClosedReason(null);
          conn.send({ type: "lobby.unsubscribe" });
          matchStore.setSeat(m.seat, m.spectator);
          setSession({ code: m.code, seat: m.seat, spectator: m.spectator, token: m.token, room: m.room });
          break;
        case "room.state":
          // 席は room.joined でだけ決まる。キックは room.closed、席の移動は新しい room.joined で届く
          setSession((s) => (s ? { ...s, room: m.room } : s));
          break;
        case "room.closed":
          writeToken(null);
          setSession(null);
          setClosedReason(m.reason === "kicked" ? "部屋から退室させられました" : m.reason === "idle" ? "部屋が放置により閉じられました" : "部屋が解散されました");
          conn.send({ type: "lobby.subscribe" });
          conn.send({ type: "lobby.query", ...queryRef.current });
          break;
        case "room.error":
          if (m.reason === "invalidToken") {
            writeToken(null);
            conn.send({ type: "lobby.subscribe" });
            conn.send({ type: "lobby.query", ...queryRef.current });
          } else {
            setError(ERRORS[m.reason]);
          }
          break;
        default:
          break;
      }
    });
    return () => {
      unsubMessage();
      unsubStatus();
      matchStore.dispose();
      conn.close();
      setConnection(null);
      setStore(null);
    };
    // 招待コードは最初の接続でだけ使う
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback((m: Parameters<Connection["send"]>[0]) => connection?.send(m), [connection]);

  const updateQuery = useCallback(
    (q: LobbyQueryState) => {
      setQuery(q);
      send({ type: "lobby.query", ...q });
    },
    [send],
  );

  const actions = {
    createRoom: (title: string, isPublic: boolean, mapName: MapName) =>
      send({ type: "room.create", playerId: profile.playerId, nickname: profile.nickname, colors: profile.colors, title, isPublic, mapName }),
    joinCode: (code: string) => send({ type: "room.join", code, playerId: profile.playerId, nickname: profile.nickname, colors: profile.colors }),
    spectate: (code: string) => send({ type: "room.spectate", code, playerId: profile.playerId, nickname: profile.nickname }),
    ready: (ready: boolean) => send({ type: "room.ready", ready }),
    setMap: (mapName: MapName) => send({ type: "room.setMap", mapName }),
    kick: (seat: Seat) => send({ type: "room.kick", seat }),
    start: () => send({ type: "room.start" }),
    takeSeat: () => send({ type: "room.takeSeat", colors: profile.colors }),
    updateProfile: (p: Profile) => send({ type: "room.profile", nickname: p.nickname, colors: p.colors }),
    leave: () => {
      send({ type: "room.leave" });
      writeToken(null);
      setSession(null);
      send({ type: "lobby.subscribe" });
      send({ type: "lobby.query", ...queryRef.current });
    },
    dissolve: () => send({ type: "room.dissolve" }),
    clearError: () => setError(null),
  };

  return { connected, session, page, query, updateQuery, error, closedReason, clockOffset, store, actions };
};
