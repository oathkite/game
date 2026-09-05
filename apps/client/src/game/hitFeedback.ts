import type { Seat, ShotResult } from "@game/protocol";
import { BLAST_RADIUS } from "@game/sim";
import type { SoundName } from "@/app/audio";

// 着弾の手応え。設計書 03 の 3.8 と 3.9、08 の 8.2 と 8.6。
// 時間の流れだけを純関数で決め、描画は replay.ts が行う。単位はミリ秒とセル。

/** 着弾の瞬間に弾を止めて見せる長さ */
export const HOLD_MS = 70;
/** 爆風が最小半径から最大半径へ広がる長さ */
export const EXPAND_MS = 120;
/** 最大半径で明滅する長さ */
export const FLICKER_MS = 300;
/** 輪だけを残して消えるまでの長さ */
export const RING_MS = 100;
/** 明滅の周期の半分 */
export const FLICKER_HALF_MS = 80;
/** 広がり始めの半径 */
export const BLAST_MIN_RADIUS = 2;
/** 着弾から地形が削れるまで */
export const CARVE_AT_MS = HOLD_MS + EXPAND_MS;
/** 着弾の演出の合計 */
export const IMPACT_TOTAL_MS = HOLD_MS + EXPAND_MS + FLICKER_MS + RING_MS;

export type BlastFrame = {
  /** 弾を着弾点に止めて見せる */
  readonly hold: boolean;
  /** 爆風の半径。0 なら描かない */
  readonly radius: number;
  /** 塗り円ではなく輪で描く */
  readonly ring: boolean;
  /** 明滅の点灯側 */
  readonly on: boolean;
  /** 地形を削った後の姿で描く */
  readonly carved: boolean;
};

/** 着弾から t ミリ秒後の爆風の見え方。合計を過ぎたら null */
export const blastFrameAt = (t: number): BlastFrame | null => {
  if (t >= IMPACT_TOTAL_MS) return null;
  if (t < HOLD_MS) return { hold: true, radius: 0, ring: false, on: false, carved: false };
  const e = t - HOLD_MS;
  if (e < EXPAND_MS) {
    const radius = BLAST_MIN_RADIUS + Math.floor(((BLAST_RADIUS - BLAST_MIN_RADIUS) * e) / EXPAND_MS);
    return { hold: false, radius, ring: false, on: true, carved: false };
  }
  const f = e - EXPAND_MS;
  if (f < FLICKER_MS) {
    return { hold: false, radius: BLAST_RADIUS, ring: false, on: Math.floor(f / FLICKER_HALF_MS) % 2 === 0, carved: true };
  }
  return { hold: false, radius: BLAST_RADIUS, ring: true, on: true, carved: true };
};

/** ダメージの段階。0 は無傷、3 は直撃 */
export type DamageTier = 0 | 1 | 2 | 3;

export const damageTier = (damage: number): DamageTier => {
  if (damage <= 0) return 0;
  if (damage < 15) return 1;
  if (damage < 25) return 2;
  return 3;
};

/** 被弾した機体を白くする長さ。地形が削れた時点から数え、爆風が消えるまで（FLICKER_MS + RING_MS）に収める */
export const FLASH_MS_BY_TIER: Readonly<Record<DamageTier, number>> = { 0: 0, 1: 120, 2: 250, 3: 400 };

export const flashMsOf = (damage: number): number => FLASH_MS_BY_TIER[damageTier(damage)];

/** 機体が白くなる瞬間に鳴らす音。自機の被弾、自分が当てた手応え、決着の順に並べる。観戦者には決着音だけ */
export const damageSounds = (shot: ShotResult, mySeat: Seat | null): readonly SoundName[] => {
  const sounds: SoundName[] = [];
  const shooter = shot.input.seat;
  const opponent: Seat = shooter === 0 ? 1 : 0;
  if (mySeat !== null && shot.damage[mySeat] > 0) sounds.push("hit");
  if (mySeat === shooter && shot.damage[opponent] > 0) sounds.push("hitConfirm");
  const killed = ([0, 1] as const).some((seat) => shot.damage[seat] > 0 && shot.hpAfter[seat] <= 0);
  if (killed) sounds.push("finish");
  return sounds;
};
