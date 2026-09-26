import { PALETTE } from "./palette";
import { CHARGE_SHAKE_FROM } from "./tankMotion";

// 発射光と溜めの火花。設計書 40.5。座標は砲口を原点とする砲身の向きの座標（u は砲身の先へ、v は砲身の下側へ、art px）。
// 時間は経過時間の純関数で、絵のコマは 1/12 秒の刻みで切り替える（参考プロンプトの 8〜12 fps）。

/** 発射光の 1 コマの長さ。4 コマで shotFlashes の 140 ms を埋める */
export const FLASH_FRAME_MS = 35;
const FLASH_FRAMES = 4;

/** 発射から age ミリ秒後の発射光のコマ（0〜3）。終われば null。動きを減らす設定では最初のコマだけ */
export const flashFrameAt = (age: number, reduced: boolean): number | null => {
  if (age < 0) return null;
  const frame = Math.floor(age / FLASH_FRAME_MS);
  if (reduced) return frame === 0 ? 0 : null;
  return frame < FLASH_FRAMES ? frame : null;
};

/** 発射光の絵。行は v の −4〜3、列は u の 0〜7。白い星形から黄、橙、灰の煙へ */
const FLASH_PATTERNS: readonly (readonly string[])[] = [
  ["...o....", "..yo....", ".ywyo...", "wwwwyyo.", "wwwwyyo.", ".ywyo...", "..yo....", "...o...."],
  ["........", "..o.....", ".oyo....", "yyyor...", "yyyor...", ".oyo....", "..o.....", "........"],
  ["........", "........", ".sr.....", "rrds....", "rdds....", ".sr.....", "........", "........"],
  ["........", "........", ".ss.....", "sSSs....", "sSSs....", ".ss.....", "........", "........"],
];

const FLASH_COLORS: Readonly<Record<string, number>> = {
  w: PALETTE.white, y: PALETTE.fire1, o: PALETTE.fire2, r: PALETTE.fire3, d: PALETTE.fire4, S: PALETTE.smoke1, s: PALETTE.smoke2,
};

/** コマ frame の、砲口から (u, v) にある画素の色。何も無ければ null */
export const flashColorAt = (frame: number, u: number, v: number): number | null => {
  const rows = FLASH_PATTERNS[frame];
  const row = rows?.[Math.floor(v) + 4];
  const cell = row?.[Math.floor(u)];
  return cell === undefined || cell === "." ? null : FLASH_COLORS[cell] ?? null;
};

export type Spark = { readonly u: number; readonly v: number; readonly color: number };

/** 溜めの点が砲口へ集まる周期（38 章の C2） */
const CHARGE_CYCLE_MS = 350;
/** 点が集まり始める距離（art px、4 セル） */
const CHARGE_REACH = 16;
/** 絵の刻み */
const STEP_MS = 1000 / 12;
const COOL_RAMP: readonly number[] = [PALETTE.greenDark, PALETTE.greenMid, PALETTE.greenLight, PALETTE.white];
const HOT_RAMP: readonly number[] = [PALETTE.fire4, PALETTE.fire3, PALETTE.fire2, PALETTE.white];

/**
 * パワーを溜めている間の火花。charge は 0〜1。38 章 C2 の点の数（1 + ⌊パワー × 5⌋、上限 5）、周期、70% からの熱い色を保ち、
 * 点を砲口へ渦を巻いて集め、近づくほど色を段で明るくする。動きを減らす設定では点を止める
 */
export const chargeSparks = (charge: number, elapsedMs: number, reduced: boolean): readonly Spark[] => {
  if (charge <= 0) return [];
  const c = Math.min(1, charge);
  const ramp = c >= CHARGE_SHAKE_FROM ? HOT_RAMP : COOL_RAMP;
  const count = 1 + Math.min(4, Math.floor(c * 5));
  const t = Math.floor(Math.max(0, elapsedMs) / STEP_MS) * STEP_MS;
  return Array.from({ length: count }, (_, i) => {
    const phase = reduced ? 0.5 : ((t + i * 70) % CHARGE_CYCLE_MS) / CHARGE_CYCLE_MS;
    const r = CHARGE_REACH * (1 - phase), a = i * 1.3 + phase * Math.PI;
    const color = ramp[Math.min(ramp.length - 1, Math.floor(phase * ramp.length))]!;
    return { u: Math.round(Math.cos(a) * r), v: Math.round(Math.sin(a) * r), color };
  });
};
