import type { MAP_CHOICES, MAP_NAMES } from "./constants.js";
import type { Facing, MatchResult, Seat, TankColors, TerrainOp, Wind } from "./match.js";
import type { Loadout } from "./weapons.js";

// 設計書 06 の 6.1 から 6.3。部屋と対戦の状態。

export type MapName = (typeof MAP_NAMES)[number];

/** 部屋のマップ設定。"random" は開始時に抽選する */
export type MapChoice = (typeof MAP_CHOICES)[number];

export type RoomPhase = "open" | "inMatch" | "result";

export type RoomMember = {
  readonly seat: Seat;
  readonly playerId: string;
  readonly nickname: string;
  readonly colors: TankColors;
  readonly loadout: Loadout;
  readonly ready: boolean;
  readonly colorConflict: boolean;
  readonly joinOrder: number;
  readonly connected: boolean;
};

export type Spectator = {
  readonly playerId: string;
  readonly nickname: string;
};

export type RoomState = {
  readonly code: string;
  readonly title: string;
  readonly isPublic: boolean;
  readonly mapName: MapChoice;
  readonly maxPlayers: number;
  readonly ownerSeat: Seat;
  readonly phase: RoomPhase;
  readonly members: readonly RoomMember[];
  readonly spectators: readonly Spectator[];
  readonly maxSpectators: number;
};

export type MatchPhase = "loading" | "turnStart" | "acting" | "resolving" | "replaying" | "finished";

export type PlayerState = {
  readonly seat: Seat;
  readonly nickname: string;
  readonly colors: TankColors;
  readonly loadout: Loadout;
  readonly hp: number;
  readonly x: number;
  /** 接地している地表の y（設計書 02 の 2.5）。天井の下の機体を表せるように x と地形だけから求めない */
  readonly y: number;
  readonly facing: Facing;
  readonly connected: boolean;
};

export type MatchState = {
  readonly roomCode: string;
  readonly mapName: MapName;
  readonly phase: MatchPhase;
  readonly turnNumber: number;
  readonly turnLimit: number;
  readonly currentSeat: Seat;
  readonly deadlineAt: number | null;
  readonly wind: Wind;
  readonly players: readonly [PlayerState, PlayerState];
  readonly terrainOps: readonly TerrainOp[];
  readonly result: MatchResult | null;
};

/** ロビーの一覧に出す 1 行 */
export type LobbyRoom = {
  readonly code: string;
  readonly title: string;
  readonly mapName: MapChoice;
  readonly players: number;
  readonly maxPlayers: number;
  readonly spectators: number;
  readonly phase: RoomPhase;
};

export type LobbyPhaseFilter = "all" | "open" | "inMatch";

export type PassReason = "timeout" | "invalidFire";

export type RoomClosedReason = "dissolved" | "idle" | "kicked";

export type RoomErrorReason =
  | "notFound"
  | "full"
  | "inMatch"
  | "notOwner"
  | "notReady"
  | "colorConflict"
  | "spectatorsFull"
  | "seatTaken"
  | "notMember"
  | "badRequest"
  | "invalidToken";
