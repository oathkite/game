import { CLIMB_MAX, STEPS_PER_TURN, TANK_RADIUS, TILT_DIFF_MAX, TILT_HALF_WIDTH } from "./constants.js";
import { clamp } from "./fixed.js";
import { TILT_TABLE } from "./tables.js";
import { surfaceY, type TerrainMask } from "./terrain.js";

// 機体の位置、傾き、移動。設計書 02 の 2.3 から 2.6。

/** 機体中心の y。地表の高さから判定半径だけ上 */
export const tankCenterY = (mask: TerrainMask, x: number): number => surfaceY(mask, x) - TANK_RADIUS;

/** 機体が奈落に落ちているか（その列に地面がない） */
export const isRingOut = (mask: TerrainMask, x: number): boolean => surfaceY(mask, x) >= mask.height;

/**
 * 車体の傾き（整数の度）。右が高いと正。
 * 左右 3 セルの地表の高さの差を -6 から +6 に収め、対応表で角度にする。
 */
export const tiltOf = (mask: TerrainMask, x: number): number => {
  // マップ端では範囲内の列で代用する。範囲外を奈落と読むと端で 45 度傾いてしまう
  const left = surfaceY(mask, clamp(x - TILT_HALF_WIDTH, 0, mask.width - 1));
  const right = surfaceY(mask, clamp(x + TILT_HALF_WIDTH, 0, mask.width - 1));
  // y は下向きなので、右が高い（右の y が小さい）と left - right が正になる
  const diff = clamp(left - right, -TILT_DIFF_MAX, TILT_DIFF_MAX);
  return TILT_TABLE[diff + TILT_DIFF_MAX] ?? 0;
};

export type StepOutcome = "moved" | "blocked" | "fell";

/**
 * 1 歩の判定。上りは高さの差が CLIMB_MAX 以下なら進める。下りは制限なし。
 * 下りた先が判定半径より深ければ落下扱いで、その歩で移動は終わる。
 */
export const stepOutcome = (mask: TerrainMask, x: number, dir: -1 | 1): StepOutcome => {
  const nx = x + dir;
  if (nx < 0 || nx >= mask.width) return "blocked";
  const here = surfaceY(mask, x);
  const there = surfaceY(mask, nx);
  const rise = here - there; // 正なら上り
  if (rise > CLIMB_MAX) return "blocked";
  if (-rise > TANK_RADIUS) return "fell";
  return "moved";
};

export type WalkResult = {
  readonly x: number;
  readonly stepsUsed: number;
  /** 落下で止まった。そのターンの移動はここで終わる */
  readonly fell: boolean;
};

/**
 * x0 から dir 方向へ最大 steps 歩進んだ結果。ブロックか落下で止まる。
 * 落下したらそのターンの移動は終わりで、クライアントはそれ以上の移動入力を受け付けない。
 * クライアントの表示とサーバーの検証（validateMove）が同じ関数を使う。
 */
export const walk = (mask: TerrainMask, x0: number, dir: -1 | 1, steps: number): WalkResult => {
  let x = x0;
  let used = 0;
  while (used < steps) {
    const outcome = stepOutcome(mask, x, dir);
    if (outcome === "blocked") break;
    x += dir;
    used++;
    if (outcome === "fell") return { x, stepsUsed: used, fell: true };
  }
  return { x, stepsUsed: used, fell: false };
};

/**
 * 射撃確定で送られた移動後の x を検証する。
 * 移動前の x から同じ方向へ、要求した歩数だけ walk して到達する位置だけを許す。
 * 行って戻る経路は再現しない（正味の移動だけを見る）。
 */
export const validateMove = (mask: TerrainMask, x0: number, x1: number): boolean => {
  if (x1 === x0) return true;
  const dir: -1 | 1 = x1 > x0 ? 1 : -1;
  const wanted = Math.abs(x1 - x0);
  if (wanted > STEPS_PER_TURN) return false;
  return walk(mask, x0, dir, wanted).x === x1;
};
