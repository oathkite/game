import type { CpuPose } from "@/practice/cpuTurn";
import type { DelayState } from "@game/protocol";
import { type Facing, type ItemId, type Loadout, type MatchResult, type Seat, type ShotResult, type TankColors, TURN_LIMIT, type WeaponId, type WeaponSlot, type Wind } from "@game/protocol";
import type { FirstShot, ProjectilePath, TerrainMask } from "@game/sim";

// クライアントが持つ対戦の表示状態。サーバーの通知から組み立て、勝手には進めない（設計書 04）。

export type PlayerView = {
  readonly seat: Seat;
  readonly nickname: string;
  readonly colors: TankColors;
  readonly loadout: Loadout;
  readonly hp: number;
  readonly x: number;
  /** 接地している地表の y。サーバーの値をそのまま持つ */
  readonly y: number;
  readonly facing: Facing;
  readonly connected: boolean;
  /** 使い終えたアイテム（設計書 42）。持たなければどれも使っていない */
  readonly itemsUsed?: readonly ItemId[] | undefined;
  /** 最後に撃った武器。ほかの参加者の砲身に描く（設計書 10.5）。まだ撃っていなければ持たない */
  readonly lastWeapon?: WeaponId | undefined;
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
  /** 移動先の地表の y。歩くたびに stepOutcome が更新する */
  readonly y: number;
  readonly facing: Facing;
  readonly elevation: number;
  /** このターンに撃つ武器のスロット（設計書 10） */
  readonly slot: WeaponSlot;
  /** このターンに使うアイテム。武器のスロットと違い、ターンをまたがない（設計書 42.1） */
  readonly item: ItemId | null;
  readonly stepsLeft: number;
  /** 落下で移動が終わった */
  readonly fell: boolean;
};

export type ReplayJob = {
  readonly id: number;
  readonly shot: ShotResult;
  /** 弾道ごとの位置列（固定小数点）。クライアントの再計算から得る。添字は Impact.projectile と対応する */
  readonly paths: readonly ProjectilePath[];
  /** 再生開始時点の地形。再生の終わりに削られる */
  readonly maskBefore: TerrainMask;
  readonly maskAfter: TerrainMask;
  readonly playersBefore: readonly [PlayerView, PlayerView];
  readonly playersAfter: readonly [PlayerView, PlayerView];
  /** ダブルシュートの 1 発目の終わり。1 発目の弾道の本数と、両者が落ちた後の位置（クライアントの再計算から得る） */
  readonly firstShot?: FirstShot | undefined;
};

export type MatchView = {
  readonly cpuPose?: CpuPose | null;
  readonly mapId?: string;
  readonly delay?: DelayState | undefined;
  readonly phase: ClientPhase;
  readonly mask: TerrainMask | null;
  readonly players: readonly [PlayerView, PlayerView] | null;
  readonly mySeat: Seat | null;
  readonly spectator: boolean;
  readonly currentSeat: Seat;
  readonly turnNumber: number;
  /** ターン数の上限。match.setup と conn.state から受け取る */
  readonly turnLimit: number;
  /** 1 ターン目の turn.start までは初期値 0 のままで、無風を意味しない。表示には match/wind.ts の decidedWind を使う */
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
  /** 最後に使った仰角。ターンをまたいで引き継ぐ */
  readonly lastElevation: number;
  /** 最後に選んだ武器のスロット。ターンをまたいで引き継ぐ */
  readonly lastSlot: WeaponSlot;
  /** 相手の手番に準備した向き（設計書 30 章、37.6）。次の自分の手番の初めの向きにし、手番が始まったら外す */
  readonly preparedFacing: Facing | null;
};

export const EMPTY_VIEW: MatchView = {
  phase: "idle",
  mask: null,
  players: null,
  mySeat: null,
  spectator: false,
  currentSeat: 0,
  turnNumber: 0,
  turnLimit: TURN_LIMIT,
  wind: { value: 0 },
  deadlineAt: null,
  control: null,
  replay: null,
  result: null,
  opponentDisconnectedUntil: null,
  mismatches: 0,
  skipNextResult: false,
  lastElevation: 45,
  lastSlot: 0,
  preparedFacing: null,
};
