import type { WeaponId } from "./weapons.js";
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
  /** 使った武器。弾道と爆風とダメージの数値を決める（設計書 10） */
  readonly weapon: WeaponId;
  /** 移動後の機体中心 x（整数セル） */
  readonly x: number;
  /** 移動後に接地している地表の y（整数セル）。サーバーが移動の検証から求める。天井の下の機体を上から見た地表と区別するために持つ（設計書 02 の 2.5） */
  readonly y: number;
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

/**
 * 着弾 1 つ。1 発の射撃は弾道が複数（扇）で、弾道ごとに着弾が複数（貫通）になりうるので、結果は着弾の列で持つ（設計書 10 の 10.2）。
 * 適用は列の順で、前の着弾が削った地形の上で次の着弾を判定する。
 */
export type Impact = {
  /** 何本目の弾道か。0 始まり。描画で弾と対応づける */
  readonly projectile: number;
  /** その弾道の何段目の着弾か。0 始まり。貫通弾とレーザー弾だけ 1 以上になる */
  readonly stage: number;
  readonly cell: CellPoint;
  readonly terrainOp: TerrainOp;
  readonly damage: readonly [number, number];
};

export type ShotResult = {
  readonly input: TrajectoryInput;
  /** 着弾の列。空なら全弾が消失した */
  readonly impacts: readonly Impact[];
  readonly hpAfter: readonly [number, number];
  readonly xAfter: readonly [number, number];
  /** 落下後に接地している地表の y。奈落なら MAP_HEIGHT */
  readonly yAfter: readonly [number, number];
  readonly ringOut: readonly Seat[];
  /** 決着していれば勝者と理由。ターン数と成績は対戦全体の状態から埋めるので、ここでは持たない */
  readonly finished: { readonly winner: Seat | null; readonly reason: "hp" | "ringOut" } | null;
};
