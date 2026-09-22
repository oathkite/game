import type { Graphics } from "pixi.js";
import { BARREL_BASE_UP } from "@game/sim";
import { blastCells } from "./weaponArt";
import { type Burst, type Dot, type Puff, smokeAt, smokeSparkOn } from "./tankMotion";

// 機体の周りに出す粒（土煙、煙、撃破の爆発）の描画。時間の流れは tankMotion.ts が決める。
// 座標は接地点を原点とするセル。機体の傾きには合わせない。

const SMOKE_TONES: readonly number[] = [0xb8c0bc, 0x818986, 0x454d4a];
const BURST_TONES: readonly number[] = [0xffffff, 0xffe14d, 0xff9f1c];
const DUST_COLOR = 0xb8c0bc;
const SPARK_COLOR = 0xffe14d;
/** 煙の発生点。砲塔の上 */
const SMOKE_ORIGIN: Dot = { x: 0, y: -BARREL_BASE_UP - 2 };

export const drawDust = (g: Graphics, dust: readonly Dot[]): void => {
  for (const d of dust) g.rect(d.x, d.y, 1, 1).fill(DUST_COLOR);
};

export const drawPuffs = (g: Graphics, puffs: readonly Puff[], origin: Dot = SMOKE_ORIGIN): void => {
  for (const p of puffs) g.rect(origin.x + p.x, origin.y + p.y, 1, 1).fill(SMOKE_TONES[p.tone] ?? DUST_COLOR);
};

/** HP が少ない機体の煙と火花 */
export const drawLowHpSmoke = (g: Graphics, elapsedMs: number, reduced: boolean): void => {
  drawPuffs(g, smokeAt(elapsedMs, reduced));
  if (smokeSparkOn(elapsedMs, reduced)) g.rect(SMOKE_ORIGIN.x + 1, SMOKE_ORIGIN.y, 1, 1).fill(SPARK_COLOR);
};

/** 残骸の煙。低い位置から 4 粒で昇る */
export const drawWreckSmoke = (g: Graphics, elapsedMs: number): void => {
  drawPuffs(g, smokeAt(elapsedMs, false, 4), { x: 0, y: -2 });
};

export const drawBursts = (g: Graphics, bursts: readonly Burst[]): void => {
  for (const b of bursts) {
    for (const c of blastCells(b.x, b.y, b.radius, b.ring)) g.rect(c.x, c.y, 1, 1);
    g.fill(BURST_TONES[b.tone] ?? 0xffffff);
  }
};
