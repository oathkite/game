import type { EngineState } from "@game/engine";
import type { ClientMessage, LobbyPhaseFilter, MapName, RoomPhase, Seat, ServerMessage, TankColors } from "@game/protocol";

// サーバーの状態と、外から入る命令、外へ出る効果。設計書 09 の部屋と 05 のプロトコル。
// 時刻は now として渡され、乱数は config.rng から引く。Date.now と Math.random は使わない。

export type ConnId = string;

export type Member = {
  readonly seat: Seat;
  readonly playerId: string;
  readonly token: string;
  readonly nickname: string;
  readonly colors: TankColors;
  readonly ready: boolean;
  readonly joinOrder: number;
  /** 接続中の接続 ID。切断中は null */
  readonly connId: ConnId | null;
  readonly closedResult: boolean;
};

export type SpectatorRecord = {
  readonly playerId: string;
  readonly token: string;
  readonly nickname: string;
  readonly connId: ConnId | null;
};

export type RoomRecord = {
  readonly code: string;
  readonly title: string;
  readonly isPublic: boolean;
  readonly mapName: MapName;
  readonly createdAt: number;
  readonly lastActivityAt: number;
  readonly ownerSeat: Seat;
  readonly phase: RoomPhase;
  readonly members: readonly Member[];
  readonly spectators: readonly SpectatorRecord[];
  readonly joinCounter: number;
  readonly engine: EngineState | null;
  readonly resultOpenedAt: number | null;
};

export type ConnectionRecord = {
  readonly roomCode: string | null;
  readonly lobbySubscribed: boolean;
  readonly lobbyQuery: LobbyQuery | null;
};

export type LobbyQuery = {
  readonly search: string;
  readonly phase: LobbyPhaseFilter;
  readonly mapName: MapName | null;
  readonly page: number;
};

export type ServerConfig = {
  readonly rng: () => number;
  readonly resultAutoCloseMs: number;
  readonly idleRoomMs: number;
  readonly lobbyThrottleMs: number;
};

export type ServerState = {
  readonly config: ServerConfig;
  readonly rooms: Map<string, RoomRecord>;
  readonly connections: Map<ConnId, ConnectionRecord>;
  /** 一覧に変化があり、まだ通知していない */
  lobbyDirty: boolean;
  lobbyNotifiedAt: number;
};

export type Command =
  | { readonly type: "open"; readonly connId: ConnId }
  | { readonly type: "message"; readonly connId: ConnId; readonly message: ClientMessage }
  | { readonly type: "close"; readonly connId: ConnId }
  | { readonly type: "tick" };

export type Outgoing = {
  readonly connId: ConnId;
  readonly message: ServerMessage;
};

export type Result = {
  readonly effects: readonly Outgoing[];
  readonly wakeAt: number | null;
};

export const DEFAULT_SERVER_TIMING: Omit<ServerConfig, "rng"> = {
  resultAutoCloseMs: 60_000,
  idleRoomMs: 30 * 60_000,
  lobbyThrottleMs: 3000,
};

export const createServerState = (config: ServerConfig): ServerState => ({
  config,
  rooms: new Map(),
  connections: new Map(),
  lobbyDirty: false,
  lobbyNotifiedAt: 0,
});
