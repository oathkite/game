import type { MatchResult, Seat, ShotResult, TankColors, Wind } from "./match.js";
import type {
  LobbyRoom,
  MapName,
  MatchState,
  PassReason,
  RoomClosedReason,
  RoomErrorReason,
  RoomState,
} from "./room.js";

// サーバーからクライアントへ送るメッセージの型。設計書 05 の 5.2 と 5.3。
// クライアントはサーバーを信頼するので Zod の検証は持たず、型だけを共有する。

export type MatchSetupPlayer = {
  readonly seat: Seat;
  readonly nickname: string;
  readonly colors: TankColors;
  readonly x: number;
};

export type ServerMessage =
  | { readonly type: "lobby.page"; readonly rooms: readonly LobbyRoom[]; readonly total: number; readonly page: number; readonly pageSize: number }
  | { readonly type: "lobby.changed" }
  | {
      readonly type: "room.joined";
      readonly code: string;
      readonly inviteUrl: string;
      readonly seat: Seat | null;
      readonly spectator: boolean;
      readonly token: string;
      readonly room: RoomState;
    }
  | { readonly type: "room.state"; readonly room: RoomState }
  | { readonly type: "room.closed"; readonly reason: RoomClosedReason }
  | { readonly type: "room.error"; readonly reason: RoomErrorReason }
  | {
      readonly type: "match.setup";
      readonly mapName: MapName;
      readonly players: readonly [MatchSetupPlayer, MatchSetupPlayer];
      readonly hp: number;
      readonly firstSeat: Seat;
      readonly turnLimit: number;
    }
  | { readonly type: "turn.start"; readonly turnNumber: number; readonly seat: Seat; readonly wind: Wind; readonly deadlineAt: number }
  | { readonly type: "turn.result"; readonly turnNumber: number; readonly shot: ShotResult; readonly finished: MatchResult | null }
  | { readonly type: "turn.pass"; readonly turnNumber: number; readonly reason: PassReason }
  | { readonly type: "match.finished"; readonly result: MatchResult }
  | { readonly type: "conn.opponentDisconnected"; readonly deadlineAt: number }
  | { readonly type: "conn.opponentReconnected" }
  | { readonly type: "conn.state"; readonly match: MatchState; readonly seat: Seat | null }
  | { readonly type: "time.pong"; readonly sentAt: number; readonly serverTime: number };

export type ServerMessageType = ServerMessage["type"];
export type ServerMessageOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>;
