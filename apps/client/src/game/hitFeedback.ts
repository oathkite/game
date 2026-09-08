import type { CellPoint, Seat } from "@game/protocol";
import { BLAST_RADIUS, MAP_HEIGHT, MAP_WIDTH } from "@game/sim";
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

/** 着弾から t ミリ秒後の爆風の見え方。合計を過ぎたら null。最大半径は武器の爆風半径（省けば標準砲） */
export const blastFrameAt = (t: number, blastRadius: number = BLAST_RADIUS): BlastFrame | null => {
  if (t >= IMPACT_TOTAL_MS) return null;
  if (t < HOLD_MS) return { hold: true, radius: 0, ring: false, on: false, carved: false };
  const e = t - HOLD_MS;
  if (e < EXPAND_MS) {
    const radius = BLAST_MIN_RADIUS + Math.floor(((blastRadius - BLAST_MIN_RADIUS) * e) / EXPAND_MS);
    return { hold: false, radius, ring: false, on: true, carved: false };
  }
  const f = e - EXPAND_MS;
  if (f < FLICKER_MS) {
    return { hold: false, radius: blastRadius, ring: false, on: Math.floor(f / FLICKER_HALF_MS) % 2 === 0, carved: true };
  }
  return { hold: false, radius: blastRadius, ring: true, on: true, carved: true };
};

/** ダメージの段階。0 は無傷、3 は標準砲の直撃に相当する大ダメージ。武器ではなくダメージの値で決める（掘削弾の直撃は 2、針弾のかすりでも 3 になる） */
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

/**
 * 機体が白くなる瞬間に鳴らす音。自機の被弾、自分が当てた手応え、決着の順に並べる。観戦者には決着音だけ。
 * 着弾 1 つごとに呼ぶ。決着音はこの着弾で HP が 0 を割った 1 回だけで、すでに沈んだ機体への続きの段では鳴らさない
 */
export const damageSounds = (
  damage: readonly [number, number],
  hpBefore: readonly [number, number],
  hpAfter: readonly [number, number],
  shooter: Seat,
  mySeat: Seat | null,
): readonly SoundName[] => {
  const sounds: SoundName[] = [];
  const opponent: Seat = shooter === 0 ? 1 : 0;
  if (mySeat !== null && damage[mySeat] > 0) sounds.push("hit");
  if (mySeat === shooter && damage[opponent] > 0) sounds.push("hitConfirm");
  const killed = ([0, 1] as const).some((seat) => damage[seat] > 0 && hpBefore[seat] > 0 && hpAfter[seat] <= 0);
  if (killed) sounds.push("finish");
  return sounds;
};

/** 弾道の 1 ステップの長さ。物理の 1 ステップを 1/60 秒で見せる */
export const STEP_MS = 1000 / 60;
/** 扇の中で次の弾道を撃つまでの間隔。遠い弾から順に出て、着弾も前から後ろへ流れる */
export const FAN_DELAY_MS = 50;
/** 同じ扇を時間差で辿る発（マルチ弾）の間隔。扇 3 本ぶん（150 ms）より長くして発が重ならないようにする */
export const VOLLEY_DELAY_MS = 180;

/** 弾道 p の発射の遅れ。扇の番号ごとに FAN_DELAY_MS、発ごとに VOLLEY_DELAY_MS（弾道の添字は 発 × 扇の本数 + 扇の番号） */
export const launchDelayMs = (projectile: number, fanCount: number): number =>
  Math.floor(projectile / fanCount) * VOLLEY_DELAY_MS + (projectile % fanCount) * FAN_DELAY_MS;

/** 発射から k 段目の着弾までの時間。前の着弾ごとに HOLD_MS だけ止まるぶんを足す */
export const impactTimeMs = (stage: number, impactAt: readonly number[]): number => (impactAt[stage] ?? 0) * STEP_MS + stage * HOLD_MS;

export type ProjectileFrame = {
  /** 位置列の添字（小数）。隣の点との補間に使う */
  readonly index: number;
  /** 着弾点で止まって見せている */
  readonly holding: boolean;
  /** 位置列の終わりを過ぎた */
  readonly ended: boolean;
};

/**
 * 発射から t ミリ秒後の弾の位置。1 ステップを STEP_MS で進み、着弾（impactAt の添字、昇順）ごとに HOLD_MS だけ止まってから続きを飛ぶ。
 * length は位置列の長さ
 */
export const projectileFrameAt = (t: number, impactAt: readonly number[], length: number): ProjectileFrame => {
  let flying = t;
  for (const at of impactAt) {
    const reach = at * STEP_MS;
    if (flying < reach) break;
    if (flying - reach < HOLD_MS) return { index: at, holding: true, ended: false };
    flying -= HOLD_MS;
  }
  const index = flying / STEP_MS;
  return { index: Math.min(index, length - 1), holding: false, ended: index >= length - 1 };
};

/** 画面揺れの長さ。地形が削れた時点から数える */
export const SHAKE_MS = 250;
/** 揺れの向きを替える間隔 */
export const SHAKE_STEP_MS = 33;
/** 揺れの幅（セル）。ダメージの段階で変える */
export const SHAKE_CELLS_BY_TIER: Readonly<Record<DamageTier, number>> = { 0: 0, 1: 1, 2: 2, 3: 3 };
/** 揺れの向きの並び。乱数を使わず、同じ着弾なら同じ揺れになる */
const SHAKE_PATTERN: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 1],
  [0, -1],
  [1, 1],
  [-1, 0],
  [0, 1],
];

export type Offset = { readonly dx: number; readonly dy: number };

/** 地形が削れてから t ミリ秒後の画面のずらし量（整数セル）。強さは両機体のうち大きいダメージで決める */
export const shakeOffsetAt = (t: number, damage: readonly [number, number]): Offset => {
  const cells = SHAKE_CELLS_BY_TIER[damageTier(Math.max(damage[0], damage[1]))];
  if (cells === 0 || t < 0 || t >= SHAKE_MS) return { dx: 0, dy: 0 };
  const amp = Math.ceil((cells * (SHAKE_MS - t)) / SHAKE_MS);
  const step = Math.floor(t / SHAKE_STEP_MS);
  const dir = SHAKE_PATTERN[step % SHAKE_PATTERN.length] ?? [0, 0];
  return { dx: dir[0] * amp, dy: dir[1] * amp };
};

/** HP バーが減り切るまでの長さ。爆風が消えるまでに収める */
export const HP_DRAIN_MS = FLICKER_MS + RING_MS;

export type HpBar = {
  /** 塗って見せる HP */
  readonly hp: number;
  /** 減る前の HP。hp との差を失った区間として点滅で見せる */
  readonly hpGhost: number;
  readonly ghostOn: boolean;
};

/** 地形が削れてから t ミリ秒後の HP バー。減る前の値から後の値へ一定の速さで減らし、失った区間を明滅させる */
export const hpBarAt = (t: number, before: number, after: number): HpBar => {
  const f = Math.min(1, Math.max(0, t) / HP_DRAIN_MS);
  const hp = before - Math.floor((before - after) * f);
  return { hp, hpGhost: before, ghostOn: Math.floor(Math.max(0, t) / FLICKER_HALF_MS) % 2 === 0 };
};

/** ダメージ数字が浮いて消えるまでの長さ */
export const DAMAGE_LABEL_MS = 600;
/** ダメージ数字が浮く高さ（px）。文字と同じく px で決め、小さな画面でも名前の上に抜ける */
export const DAMAGE_LABEL_RISE_PX = 24;
/** 名前の文字との隙間（px） */
export const DAMAGE_LABEL_GAP_PX = 4;

export const damageLabelText = (damage: number): string => `-${damage}`;

/** 破片が飛んで消えるまでの長さ。爆風が消えるまでに収める */
export const DEBRIS_MS = FLICKER_MS + RING_MS;
/** 破片の重さ（セル/秒²） */
export const DEBRIS_GRAVITY = 400;
/** 破片の初速（セル/秒）。上へ寄せた 8 方向を左右対称の対で並べ、乱数を使わない。最も高い破片は約 10 セル上がって 0.23 秒で落ち始める */
const DEBRIS_VELOCITIES: readonly (readonly [number, number])[] = [
  [-10, -91],
  [10, -91],
  [-29, -83],
  [29, -83],
  [-47, -68],
  [47, -68],
  [-62, -39],
  [62, -39],
];

/** 破片の数。爆風が広いほど多く、狭い爆風（レーザー弾、針弾）は 2 個。左右対称を保つため偶数 */
export const debrisCount = (blastRadius: number): number => {
  if (blastRadius >= BLAST_RADIUS) return 8;
  if (blastRadius >= 6) return 6;
  if (blastRadius >= 3) return 4;
  return 2;
};
/** 最も高い破片が頂点に達する時刻 */
export const DEBRIS_APEX_MS = 230;

/** 地形が削れてから t ミリ秒後の破片の位置（セル、格子に揃える）。左右対称に散るよう 0 へ向けて丸める。消えたら空。数は爆風半径で決まる */
export const debrisAt = (t: number, impact: CellPoint, blastRadius: number = BLAST_RADIUS): readonly CellPoint[] => {
  if (t < 0 || t >= DEBRIS_MS) return [];
  const sec = t / 1000;
  return DEBRIS_VELOCITIES.slice(0, debrisCount(blastRadius)).map(([vx, vy]) => ({
    x: impact.x + Math.trunc(vx * sec),
    y: impact.y + Math.trunc(vy * sec + (DEBRIS_GRAVITY * sec * sec) / 2),
  }));
};

/** 外れ（弾がマップの外へ出た）の印を出す長さ */
export const MISS_MS = 200;
/** 印の明滅の周期の半分 */
export const MISS_BLINK_MS = 50;

export type MissMark = { readonly x: number; readonly y: number; readonly on: boolean };

/** 弾が消えた位置をマップの端に寄せ、t ミリ秒後の印。過ぎたら null */
export const missMarkAt = (t: number, last: CellPoint): MissMark | null => {
  if (t < 0 || t >= MISS_MS) return null;
  const x = Math.min(MAP_WIDTH - 2, Math.max(1, last.x));
  const y = Math.min(MAP_HEIGHT - 2, Math.max(1, last.y));
  return { x, y, on: Math.floor(t / MISS_BLINK_MS) % 2 === 0 };
};
