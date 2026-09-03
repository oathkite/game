import type { Facing, MatchResult, Seat, ShotResult, TankColors, Wind } from "@game/protocol";
import type { FixedPoint, TerrainMask } from "@game/sim";

// クライアントが持つ対戦の表示状態。サーバーの通知から組み立て、勝手には進めない（設計書 04）。

export type PlayerView = {
  readonly seat: Seat;
  readonly nickname: string;
  readonly colors: TankColors;
  readonly hp: number;
  readonly x: number;
  readonly facing: Facing;
  readonly connected: boolean;
};

export type ClientPhase =
  | "idle"
  | "loading"
  /** 手番側が操作できる */
  | "acting"
  /** 射撃を送り、結果を待っている */
  | "fired"
  /** 相手の手番、またはパスの直後で次の turn.start を待っている */
  | "waiting"
  | "replaying"
  | "finished";

/** 手番側がクライアント内で持つ操作中の値。射撃確定時にまとめて送る */
export type LocalControl = {
  readonly x: number;
  readonly facing: Facing;
  readonly elevation: number;
  readonly stepsLeft: number;
  /** 落下で移動が終わった */
  readonly fell: boolean;
};

export type ReplayJob = {
  readonly id: number;
  readonly shot: ShotResult;
  /** 弾の位置列（固定小数点）。クライアントの再計算から得る */
  readonly path: readonly FixedPoint[];
  /** 再生開始時点の地形。再生の終わりに削られる */
  readonly maskBefore: TerrainMask;
  readonly maskAfter: TerrainMask;
  readonly playersBefore: readonly [PlayerView, PlayerView];
  readonly playersAfter: readonly [PlayerView, PlayerView];
};

export type MatchView = {
  readonly phase: ClientPhase;
  readonly mask: TerrainMask | null;
  readonly players: readonly [PlayerView, PlayerView] | null;
  readonly mySeat: Seat | null;
  readonly spectator: boolean;
  readonly currentSeat: Seat;
  readonly turnNumber: number;
  readonly wind: Wind;
  /** サーバー時刻の期限 */
  readonly deadlineAt: number | null;
  readonly control: LocalControl | null;
  readonly replay: ReplayJob | null;
  readonly result: MatchResult | null;
  readonly opponentDisconnectedUntil: number | null;
  readonly mismatches: number;
  /** 再接続で Replaying の途中に復帰した。次の turn.result は再生せず確定状態のままにする */
  readonly skipNextResult: boolean;
};

export const EMPTY_VIEW: MatchView = {
  phase: "idle",
  mask: null,
  players: null,
  mySeat: null,
  spectator: false,
  currentSeat: 0,
  turnNumber: 0,
  wind: { value: 0 },
  deadlineAt: null,
  control: null,
  replay: null,
  result: null,
  opponentDisconnectedUntil: null,
  mismatches: 0,
  skipNextResult: false,
};
