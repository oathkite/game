import type { MapName, Seat, ServerMessageOf } from "@game/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { measureClockOffset } from "@/app/clockSync";
import type { Profile } from "@/app/profile";
import { createMatchStore, type MatchStore } from "@/match/matchStore";
import type { Connection } from "@/net/connection";
import { createWsConnection } from "@/net/wsConnection";
import type { LobbyQueryState } from "./LobbyScreen";
import { handleServerMessage, onConnectionOpen, type RoomSession, type SessionContext } from "./sessionHandlers";

// オンライン対戦の接続と画面段階。接続とストアは effect の中で作り、StrictMode の二重マウントに耐える。

const TOKEN_KEY = "fortress.session.v1";


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
    const ctx: SessionContext = {
      conn,
      matchStore,
      query: () => queryRef.current,
      profile: () => profileRef.current,
      hasSession: () => sessionRef.current !== null,
      setPage,
      setSession,
      setError,
      setClosedReason,
      readToken,
      writeToken,
    };
    const unsubStatus = conn.onStatus((status) => {
      setConnected(status === "open");
      if (status !== "open") return;
      void measureClockOffset(conn).then((r) => setClockOffset(r.offset));
      // 招待コードは最初の接続でだけ使う
      const invite = inviteUsed.current ? null : inviteCode;
      inviteUsed.current = true;
      onConnectionOpen(ctx, invite);
    });
    const unsubMessage = conn.subscribe((m) => handleServerMessage(ctx, m));
    return () => {
      unsubMessage();
      unsubStatus();
      matchStore.dispose();
      conn.close();
      setConnection(null);
      setStore(null);
    };
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
