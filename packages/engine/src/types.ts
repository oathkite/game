import type { ClientMessageOf, MatchState, Seat, SeatStats, ServerMessage, ServerMessageOf } from "@game/protocol";
import type { TerrainMask } from "@game/sim";

// 対戦エンジンの内部状態と出来事。設計書 04 の状態遷移を純関数で表す。
// エンジンは時刻を読まず、呼び出し側が now を渡す。乱数も呼び出し側が rng として渡す。

export type EngineConfig = {
  readonly turnMs: number;
  /** 期限後に射撃確定を受け付ける猶予 */
  readonly graceMs: number;
  readonly replayWaitMs: number;
  readonly reconnectWaitMs: number;
  readonly turnLimit: number;
  /** 0 以上 1 未満の値を返す。風の抽選と先攻の決定に使う */
  readonly rng: () => number;
};

export type EngineState = {
  readonly config: EngineConfig;
  readonly match: MatchState;
  readonly mask: TerrainMask;
  readonly loaded: readonly [boolean, boolean];
  readonly replayDone: readonly [boolean, boolean];
  /** このターンに射撃確定を受理したか */
  readonly fired: boolean;
  /** 手番側が切断して制限時間を止めているとき、残り時間 */
  readonly pausedRemainingMs: number | null;
  /** Replaying の打ち切り時刻 */
  readonly replayWakeAt: number | null;
  /** 席ごとの再接続の期限 */
  readonly disconnectDeadlines: readonly [number | null, number | null];
  /** 突風の記録。クライアントには送らない */
  readonly gusts: readonly boolean[];
  readonly stats: readonly [SeatStats, SeatStats];
  /** 再接続した側に送り直すための最後の射撃結果 */
  readonly lastResult: ServerMessageOf<"turn.result"> | null;
  readonly lastTurnStart: ServerMessageOf<"turn.start"> | null;
};

export type EngineEvent =
  | { readonly type: "loaded"; readonly seat: Seat }
  | { readonly type: "fire"; readonly seat: Seat; readonly fire: ClientMessageOf<"turn.fire"> }
  | { readonly type: "replayDone"; readonly seat: Seat }
  | { readonly type: "surrender"; readonly seat: Seat }
  | { readonly type: "disconnect"; readonly seat: Seat }
  | { readonly type: "reconnect"; readonly seat: Seat }
  | { readonly type: "dissolve" }
  | { readonly type: "tick" };

export type Effect = {
  /** all は両席と観戦者。席番号ならその席だけ */
  readonly to: "all" | Seat;
  readonly message: ServerMessage;
};

export type Step = {
  readonly state: EngineState;
  readonly effects: readonly Effect[];
  /** 次に tick を呼んでほしい時刻。null なら待つものがない */
  readonly wakeAt: number | null;
};

export const otherSeat = (seat: Seat): Seat => (seat === 0 ? 1 : 0);
