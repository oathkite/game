// 設計書 06 データモデルの型。sim と server と client が共有する。
// ここでは対戦に関わる型だけを置き、部屋やメッセージの型はサーバー実装時に足す。

export type Seat = 0 | 1;

/** -1 が左、1 が右 */
export type Facing = -1 | 1;

export type PlayerColor =
  | "red"
  | "orange"
  | "yellow"
  | "cyan"
  | "blue"
  | "pink"
  | "purple";

export type TankColors = {
  readonly primary: PlayerColor;
  readonly secondary: PlayerColor;
};

export type Wind = {
  /** -10 から 10 の整数。突風で再抽選されたかどうかはクライアントに送らないので持たない */
  readonly value: number;
};

export type TrajectoryInput = {
  readonly seat: Seat;
  /** 移動後の機体中心 x（整数セル） */
  readonly x: number;
  readonly facing: Facing;
  /** 10 から 90 の整数（度）。車体基準の仰角 */
  readonly elevation: number;
  /** 0 から 100 の整数 */
  readonly power: number;
  /** -10 から 10 の整数 */
  readonly wind: number;
};

export type TerrainOp = {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
};

export type FinishReason =
  | "hp"
  | "ringOut"
  | "turnLimit"
  | "surrender"
  | "disconnect"
  | "dissolved";

export type SeatStats = {
  readonly damageDealt: number;
  readonly directHits: number;
};

export type MatchResult = {
  readonly winner: Seat | null;
  readonly reason: FinishReason;
  readonly turns: number;
  readonly stats: readonly [SeatStats, SeatStats];
};

export type CellPoint = {
  readonly x: number;
  readonly y: number;
};

export type ShotResult = {
  readonly input: TrajectoryInput;
  readonly impact: CellPoint | null;
  readonly terrainOp: TerrainOp | null;
  readonly damage: readonly [number, number];
  readonly hpAfter: readonly [number, number];
  readonly xAfter: readonly [number, number];
  readonly ringOut: readonly Seat[];
  /** 決着していれば勝者と理由。ターン数と成績は対戦全体の状態から埋めるので、ここでは持たない */
  readonly finished: { readonly winner: Seat | null; readonly reason: "hp" | "ringOut" } | null;
};
