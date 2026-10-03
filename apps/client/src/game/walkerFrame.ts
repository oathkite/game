import { createGrid, fillRect, setPixel, type PixelGrid } from "./pixelGrid";
import { A, C, dots, E, F, mod, rows, stroke, wreckChips, type FrameParts, type Point } from "./frameDraw";
import { MATERIAL as M } from "./tankShape";

// 多脚のフレーム（設計書 43）。4 本の脚で歩き、膝は腿と脛の長さから毎コマ解く。

// ---- 多脚。膝を車体より高く上げたカニ型。脚先に爪 ----
type LegPose = { readonly hip: Point; readonly knee: Point; readonly foot: Point };
const walkerLeg = (grid: PixelGrid, pose: LegPose, near: boolean): void => {
  const main = near ? M.metalBase : M.metalDeep, dark = near ? M.metalShadow : M.metalDeep;
  // 腿は 2 px で上に油圧の筋、脛は先へ細くする
  stroke(grid, pose.hip, pose.knee, 2, main);
  if (near) stroke(grid, { x: pose.hip.x, y: pose.hip.y - 1 }, { x: pose.knee.x, y: pose.knee.y - 1 }, 1, M.metalLight);
  const mid = { x: Math.round((pose.knee.x + pose.foot.x) / 2), y: Math.round((pose.knee.y + pose.foot.y) / 2) };
  stroke(grid, pose.knee, mid, 2, dark);
  stroke(grid, mid, pose.foot, 1, dark);
  // 腰と膝の関節、膝の上の棘
  fillRect(grid, pose.hip.x - 1, pose.hip.y - 1, 3, 3, near ? M.metalShadow : M.metalDeep);
  if (near) setPixel(grid, pose.hip.x - 1, pose.hip.y - 1, M.metalLight);
  fillRect(grid, pose.knee.x - 1, pose.knee.y - 1, 3, 3, near ? M.metalLight : M.metalShadow);
  setPixel(grid, pose.knee.x, pose.knee.y - 2, near ? M.metalLight : M.metalShadow);
  setPixel(grid, pose.knee.x, pose.knee.y - 3, near ? M.metalBase : M.metalDeep);
  // 爪
  const out = Math.sign(pose.foot.x - pose.hip.x) || 1;
  setPixel(grid, pose.foot.x + out, pose.foot.y, dark);
  fillRect(grid, pose.foot.x - 1, pose.foot.y + 1, 3, 1, dark);
};
// 歩容。4 本を 1/4 周期ずつずらして順に上げ（後ろ手前 → 前手前 → 後ろ奥 → 前奥）、常に 3 本が接地する。
// 接地中の足は地面に留まって後ろへ流れ、上げた足は弧を描いて前へ戻る。膝は腿と脛の長さから毎コマ解く（2 関節の IK）
const GAIT_CYCLE = 12;
const STANCE = 0.75;
const STRIDE = GAIT_CYCLE * STANCE;
const LIFT = 3;
type LegSpec = { readonly hipX: number; readonly footX: number; readonly thigh: number; readonly shin: number; readonly offset: number; readonly near: boolean };
// 腿より脛を長くして、膝を車体より上へ張り出させる
const LEGS: readonly LegSpec[] = [
  { hipX: -4, footX: -16, thigh: 9, shin: 12, offset: 0.5, near: false },
  { hipX: 3, footX: 15, thigh: 9, shin: 12, offset: 0.75, near: false },
  { hipX: -8, footX: -22, thigh: 12, shin: 16, offset: 0, near: true },
  { hipX: 7, footX: 21, thigh: 12, shin: 16, offset: 0.25, near: true },
];
const footAt = (spec: LegSpec, phase: number, wrecked: boolean): Point => {
  const side = Math.sign(spec.footX - spec.hipX);
  if (wrecked) return { x: spec.footX + side * 4, y: -2 };
  const t = mod(phase / GAIT_CYCLE + spec.offset, 1);
  if (t < STANCE) return { x: spec.footX + STRIDE / 2 - STRIDE * (t / STANCE), y: -2 };
  const u = (t - STANCE) / (1 - STANCE);
  const ease = u * u * (3 - 2 * u);
  return { x: spec.footX - STRIDE / 2 + STRIDE * ease, y: -2 - LIFT * Math.sin(Math.PI * u) };
};
/** 腰と足先から膝を解く。2 つの解のうち高い方（膝が上に出る方） */
const kneeAt = (hip: Point, foot: Point, thigh: number, shin: number): Point => {
  const dx = foot.x - hip.x, dy = foot.y - hip.y;
  const d = Math.min(thigh + shin - 0.01, Math.max(Math.abs(thigh - shin) + 0.01, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const bend = Math.acos((thigh * thigh + d * d - shin * shin) / (2 * thigh * d));
  const a = { x: hip.x + thigh * Math.cos(base + bend), y: hip.y + thigh * Math.sin(base + bend) };
  const b = { x: hip.x + thigh * Math.cos(base - bend), y: hip.y + thigh * Math.sin(base - bend) };
  return a.y < b.y ? a : b;
};
const round = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });
export const walkerFrame = (phase: number, sink: number, wrecked: boolean): FrameParts => {
  const drop = wrecked ? 3 : 0;
  const far = createGrid(-28, -24, 56, 25), near = createGrid(-28, -24, 56, 25);
  for (const spec of LEGS) {
    const hip = { x: spec.hipX, y: -9 + drop + sink };
    const foot = footAt(spec, phase, wrecked);
    walkerLeg(spec.near ? near : far, { hip, knee: round(kneeAt(hip, foot, spec.thigh, spec.shin)), foot: round(foot) }, spec.near);
  }
  const body = createGrid(-16, -16 + sink + drop, 32, 11);
  rows(body, [[-13, -9, 8, A], [-12, -12, 11, C], [-11, -13, 13, C], [-10, -13, 14, C], [-9, -12, 13, E], [-8, -10, 10, F], [-7, -6, 6, M.metalDeep], [-6, -3, 3, M.metalShadow]], sink + drop);
  // 赤い目のセンサー、装甲の継ぎ目、後ろの吸気口
  dots(body, [[10, -10, M.hole], [11, -10, wrecked ? M.hole : M.warhead], [12, -10, wrecked ? M.hole : M.warhead], [13, -10, M.hole],
    [-3, -11, E], [-3, -10, E], [-11, -11, M.hole], [-11, -10, M.hole], [-9, -11, M.hole], [-9, -10, M.hole]], sink + drop);
  if (wrecked) wreckChips(body, -13, sink + drop);
  // 腰の関節を主色の肩当てで覆う。手前の脚より上に描く
  const pads = createGrid(-16, -14 + sink + drop, 32, 5);
  if (!wrecked) for (const x of [-10, 5]) {
    fillRect(pads, x, -12 + sink, 4, 1, A);
    fillRect(pads, x, -11 + sink, 4, 2, C);
    setPixel(pads, x + 1, -11 + sink, M.rivet);
  }
  return { under: [{ mask: far, outline: true }], hull: body, over: [{ mask: near, outline: true }, { mask: pads, outline: true }] };
};

