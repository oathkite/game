import type { Graphics } from "pixi.js";
import { BARREL_BASE_UP } from "@game/sim";
import { explosionPixels, type BlastStage } from "./explosionSprite";
import { PALETTE, type Ramp } from "./palette";
import { ART_PER_CELL, colorRuns, type ColorRun } from "./pixelGrid";
import { type Burst, type Dot, type Puff, smokeAt, smokeSparkOn } from "./tankMotion";

// 機体の周りに出す粒（土煙、煙、撃破の爆発）の描画。時間の流れは tankMotion.ts が決める（設計書 38）。
// 絵は設計書 40.5 と 40.9。座標は接地点を原点とするセルで、粒は art px（1/4 セル）の格子に揃える。機体の傾きには合わせない。

const ART = 1 / ART_PER_CELL;
/** 煙の発生点。砲塔の上 */
const SMOKE_ORIGIN: Dot = { x: 0, y: -BARREL_BASE_UP - 2 };
/** 撃破の爆発の輪は、撃った側ではなく炎の色で描く */
const FIRE_RING: Ramp = { light: PALETTE.fire1, base: PALETTE.fire3, shadow: PALETTE.fire5, deep: PALETTE.fire6 };

/** 着地の土煙。2 × 2 art px の粒で、下の段を一段暗くする */
export const drawDust = (g: Graphics, dust: readonly Dot[]): void => {
  for (const d of dust) {
    g.rect(d.x + ART, d.y + ART, 2 * ART, ART).fill(PALETTE.smoke0);
    g.rect(d.x + ART, d.y + 2 * ART, 2 * ART, ART).fill(PALETTE.smoke1);
  }
};

/** 煙の粒。昇るにつれ（tone が進むにつれ）大きく暗くなり、最後は小さく薄れる */
export const drawPuffs = (g: Graphics, puffs: readonly Puff[], origin: Dot = SMOKE_ORIGIN): void => {
  for (const p of puffs) {
    const size = p.tone === 1 ? 3 : 2, color = p.tone === 0 ? PALETTE.smoke1 : p.tone === 1 ? PALETTE.smoke2 : PALETTE.smoke3;
    const x = origin.x + p.x + 0.5 - (size * ART) / 2, y = origin.y + p.y + 0.5 - (size * ART) / 2;
    const sx = Math.round(x * ART_PER_CELL) * ART, sy = Math.round(y * ART_PER_CELL) * ART;
    g.rect(sx, sy, size * ART, size * ART).fill(color);
    if (p.tone === 0) g.rect(sx, sy, ART, ART).fill(PALETTE.smoke0);
  }
};

/** HP が少ない機体の煙と火花 */
export const drawLowHpSmoke = (g: Graphics, elapsedMs: number, reduced: boolean): void => {
  drawPuffs(g, smokeAt(elapsedMs, reduced));
  if (smokeSparkOn(elapsedMs, reduced)) g.rect(SMOKE_ORIGIN.x + 1 + ART, SMOKE_ORIGIN.y + ART, ART, ART).fill(PALETTE.fire2);
};

/** 残骸の煙。低い位置から 4 粒で昇る */
export const drawWreckSmoke = (g: Graphics, elapsedMs: number): void => {
  drawPuffs(g, smokeAt(elapsedMs, false, 4), { x: 0, y: -2 });
};

const burstRuns = new Map<string, readonly ColorRun[]>();

/** 撃破の小爆発の絵。半径と段階ごとに一度だけ作る */
const runsOf = (radius: number, stage: BlastStage): readonly ColorRun[] => {
  const key = `${radius}|${stage}`;
  const found = burstRuns.get(key);
  if (found) return found;
  const runs = colorRuns(explosionPixels("cannon", radius, stage, FIRE_RING));
  burstRuns.set(key, runs);
  return runs;
};

/** 撃破の 3 連爆発。白と黄の段は熱い火球、橙の段は冷えた火球、輪は炎の色の輪 */
export const drawBursts = (g: Graphics, bursts: readonly Burst[]): void => {
  for (const b of bursts) {
    const stage: BlastStage = b.ring ? "ring" : b.tone === 2 ? "cool" : "hot";
    for (const r of runsOf(b.radius, stage)) g.rect(b.x + 0.5 + r.x * ART, b.y + 0.5 + r.y * ART, r.w * ART, ART).fill(r.color);
  }
};
