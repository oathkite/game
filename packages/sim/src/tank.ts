import { CLIMB_MAX, STEPS_PER_TURN, TANK_RADIUS, TILT_DIFF_MAX, TILT_HALF_WIDTH } from "./constants.js";
import { clamp } from "./fixed.js";
import { TILT_TABLE } from "./tables.js";
import { groundBelow, isSolid, type TerrainMask } from "./terrain.js";

// 機体の位置、傾き、移動。設計書 02 の 2.3 から 2.6。
// 機体は x と「接地している地表の y」を持つ。地表は「今の高さから下へ見て最初にある地面」で、
// 上から見た最初の地面ではない。天井の下（洞窟）に機体を置けるようにするためである。

/** 機体の位置。y は接地している地表の行（機体中心は y − 判定半径） */
export type TankPos = {
  readonly x: number;
  readonly y: number;
};

/** 機体の高さ。地表から上にこのセル数が空いていないと、その列には立てない */
export const TANK_HEIGHT = TANK_RADIUS * 2;

/** 機体中心の y。地表の高さから判定半径だけ上 */
export const tankCenterY = (pos: TankPos): number => pos.y - TANK_RADIUS;

/** 機体が奈落に落ちているか（地表が下端より下） */
export const isRingOut = (mask: TerrainMask, pos: TankPos): boolean => pos.y >= mask.height;

/** スポーン。x 列を fromY から下へ見て最初にある地面に立つ。fromY を 0 にすれば上から最初の地面 */
export const spawnPos = (mask: TerrainMask, x: number, fromY = 0): TankPos => ({ x, y: groundBelow(mask, x, fromY) });

/** 地形が削られた後の位置。足元が残っていればそのまま、失っていれば真下の次の地面まで落ちる */
export const settle = (mask: TerrainMask, pos: TankPos): TankPos => ({ x: pos.x, y: groundBelow(mask, pos.x, pos.y) });

/** 地表 ground の上に機体の高さぶんの空きがあるか。天井や壁の中には入れない */
export const hasClearance = (mask: TerrainMask, x: number, ground: number): boolean => {
  if (ground >= mask.height) return true;
  for (let y = ground - TANK_HEIGHT; y < ground; y++) if (isSolid(mask, x, y)) return false;
  return true;
};

/**
 * 隣の列の地表。今の地表より CLIMB_MAX だけ上から下へ見て最初にある地面。
 * 上から見ないのは、天井の上を地表と数えないため。上りの上限はここで自然に効く
 */
const neighborGround = (mask: TerrainMask, nx: number, y: number, climb: number): number => groundBelow(mask, nx, y - climb);

/**
 * 車体の傾き（整数の度）。右が高いと正。
 * 左右 3 セルの地表の高さの差を -6 から +6 に収め、対応表で角度にする。
 * 左右の地表は今の地表より 6 セル上から下へ見る。それより高い天井は地表と数えない
 */
export const tiltOf = (mask: TerrainMask, pos: TankPos): number => {
  // マップ端では範囲内の列で代用する。範囲外を奈落と読むと端で 45 度傾いてしまう
  const left = neighborGround(mask, clamp(pos.x - TILT_HALF_WIDTH, 0, mask.width - 1), pos.y, TILT_DIFF_MAX);
  const right = neighborGround(mask, clamp(pos.x + TILT_HALF_WIDTH, 0, mask.width - 1), pos.y, TILT_DIFF_MAX);
  // y は下向きなので、右が高い（右の y が小さい）と left - right が正になる
  const diff = clamp(left - right, -TILT_DIFF_MAX, TILT_DIFF_MAX);
  return TILT_TABLE[diff + TILT_DIFF_MAX] ?? 0;
};

export type StepKind = "moved" | "blocked" | "fell";

export type StepOutcome = {
  readonly kind: StepKind;
  /** 移動後の地表の y。blocked なら今の y のまま */
  readonly y: number;
};

/**
 * 1 歩の判定。移動先の地表は今より CLIMB_MAX 上から下へ見て最初の地面なので、それより高い上りは見つからず、
 * 機体の高さぶんの空きがない（壁や低い天井）ときは進めない。下りは制限なし。
 * 下りた先が判定半径より深ければ落下扱いで、その歩で移動は終わる。落下先は真下の次の地面（なければ奈落）
 */
export const stepOutcome = (mask: TerrainMask, pos: TankPos, dir: -1 | 1): StepOutcome => {
  const nx = pos.x + dir;
  if (nx < 0 || nx >= mask.width) return { kind: "blocked", y: pos.y };
  const there = neighborGround(mask, nx, pos.y, CLIMB_MAX);
  if (!hasClearance(mask, nx, there)) return { kind: "blocked", y: pos.y };
  const drop = there - pos.y;
  return { kind: drop > TANK_RADIUS ? "fell" : "moved", y: there };
};

export type WalkResult = {
  readonly x: number;
  readonly y: number;
  readonly stepsUsed: number;
  /** 落下で止まった。そのターンの移動はここで終わる */
  readonly fell: boolean;
};

/**
 * pos から dir 方向へ最大 steps 歩進んだ結果。ブロックか落下で止まる。
 * 落下したらそのターンの移動は終わりで、クライアントはそれ以上の移動入力を受け付けない。
 * クライアントの表示とサーバーの検証（validateMove）が同じ関数を使う。
 */
export const walk = (mask: TerrainMask, pos: TankPos, dir: -1 | 1, steps: number): WalkResult => {
  let { x, y } = pos;
  let used = 0;
  while (used < steps) {
    const outcome = stepOutcome(mask, { x, y }, dir);
    if (outcome.kind === "blocked") break;
    x += dir;
    y = outcome.y;
    used++;
    if (outcome.kind === "fell") return { x, y, stepsUsed: used, fell: true };
  }
  return { x, y, stepsUsed: used, fell: false };
};

/**
 * 射撃確定で送られた移動後の x を検証し、移動後の位置を返す。許されない移動なら null。
 * 移動前の位置から同じ方向へ、要求した歩数だけ walk して到達する位置だけを許す。
 * 行って戻る経路は再現しない（正味の移動だけを見る）。
 */
export const validateMove = (mask: TerrainMask, from: TankPos, x1: number): TankPos | null => {
  if (x1 === from.x) return from;
  const dir: -1 | 1 = x1 > from.x ? 1 : -1;
  const wanted = Math.abs(x1 - from.x);
  if (wanted > STEPS_PER_TURN) return null;
  const r = walk(mask, from, dir, wanted);
  return r.x === x1 ? { x: r.x, y: r.y } : null;
};
