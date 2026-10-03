import { createGrid, fillRect, setPixel, type PixelGrid } from "./pixelGrid";
import { A, C, dots, E, F, mod, rows, stroke, type FrameParts, type Point } from "./frameDraw";
import { MATERIAL as M } from "./tankShape";

// 逆関節のフレーム（設計書 43.6）。鳥の脚の 2 本足で、膝が後ろへ折れる。
// 砲身の付け根の高さが決まっているので、脚に使えるのは車体の下の約 10 px。腿を胴の側面に重ねて太く見せ、
// 足首を地面から 3 px 浮かせて前へ爪を伸ばす。接地の真ん中を機体の重心（x ≈ −1）の真下に置く。

// 歩容。手前と奥を半周期ずらす。接地中の足首は地面に留まって後ろへ流れ、上げた足は弧を描いて前へ戻る
const GAIT_CYCLE = 12;
const STANCE = 0.6;
const STRIDE = GAIT_CYCLE * STANCE;
const LIFT = 2;
const ANKLE_Y = -3;
const THIGH = 6, SHIN = 6;
/** 腰と足首を一緒に後ろへ置き、足先の接地を重心の真下に合わせる */
const LEGS = [
  { hipX: -2, ankleX: -1, offset: 0.5, near: false },
  { hipX: -5, ankleX: -4, offset: 0, near: true },
] as const;

export type ReverseLegPose = { readonly hip: Point; readonly knee: Point; readonly ankle: Point; readonly near: boolean };

const ankleAt = (ankleX: number, offset: number, phase: number): Point => {
  const t = mod(phase / GAIT_CYCLE + offset, 1);
  if (t < STANCE) return { x: ankleX + STRIDE / 2 - STRIDE * (t / STANCE), y: ANKLE_Y };
  const u = (t - STANCE) / (1 - STANCE);
  const ease = u * u * (3 - 2 * u);
  return { x: ankleX - STRIDE / 2 + STRIDE * ease, y: ANKLE_Y - LIFT * Math.sin(Math.PI * u) };
};
/** 腰と足首から膝を解く。2 つの解のうち後ろの方（膝が後ろへ折れる方） */
const kneeBehind = (hip: Point, ankle: Point): Point => {
  const dx = ankle.x - hip.x, dy = ankle.y - hip.y;
  const d = Math.min(THIGH + SHIN - 0.01, Math.max(0.01, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const bend = Math.acos((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d));
  const a = { x: hip.x + THIGH * Math.cos(base + bend), y: hip.y + THIGH * Math.sin(base + bend) };
  const b = { x: hip.x + THIGH * Math.cos(base - bend), y: hip.y + THIGH * Math.sin(base - bend) };
  return a.x < b.x ? a : b;
};

/** 2 本の脚の腰、膝、足首。奥の脚が先。dy は車体の沈み。残骸は膝を折って座り込み、足を前へ投げ出す */
export const reverseLegPoses = (phase: number, dy: number, wrecked: boolean): readonly ReverseLegPose[] =>
  LEGS.map(leg => {
    const hip = { x: leg.hipX, y: -10 + dy };
    const ankle = wrecked ? { x: leg.hipX + 4, y: ANKLE_Y } : ankleAt(leg.ankleX, leg.offset, phase);
    return { hip, knee: kneeBehind(hip, ankle), ankle, near: leg.near };
  });

const round = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** 腿は主色の太い装甲で、上の縁を明るく、下の縁を暗く。手前の脚は腰に丸い装甲を被せる */
const thigh = (grid: PixelGrid, hip: Point, knee: Point, near: boolean): void => {
  stroke(grid, hip, knee, 3, near ? C : E);
  stroke(grid, { x: hip.x - 1, y: hip.y + 2 }, { x: knee.x + 1, y: knee.y + 1 }, 1, near ? E : F);
  stroke(grid, { x: hip.x - 1, y: hip.y - 1 }, { x: knee.x - 1, y: knee.y - 1 }, 1, near ? A : C);
  if (!near) return;
  fillRect(grid, hip.x - 1, hip.y - 1, 3, 1, A);
  fillRect(grid, hip.x - 2, hip.y, 5, 2, C);
  setPixel(grid, hip.x - 2, hip.y, A);
  fillRect(grid, hip.x - 1, hip.y + 2, 3, 1, E);
  setPixel(grid, hip.x, hip.y, M.rivet);
};

const leg = (grid: PixelGrid, pose: ReverseLegPose): void => {
  const { near } = pose;
  const hip = round(pose.hip), knee = round(pose.knee), a = round(pose.ankle);
  const metal = near ? M.metalBase : M.metalShadow, metalDark = near ? M.metalShadow : M.metalDeep;
  // 脛は 2 px の金属で、膝から足首へ前に下りる
  stroke(grid, knee, a, 2, metal);
  stroke(grid, { x: knee.x + 1, y: knee.y + 1 }, { x: a.x + 1, y: a.y }, 1, metalDark);
  thigh(grid, hip, knee, near);
  // 膝の関節。後ろへ突き出す
  fillRect(grid, knee.x - 1, knee.y - 1, 3, 3, near ? M.metalLight : M.metalShadow);
  setPixel(grid, knee.x, knee.y, metalDark);
  // 足首の関節と、前へ斜めに下りる爪、後ろの蹴爪
  fillRect(grid, a.x - 1, a.y, 2, 2, near ? M.metalLight : M.metalShadow);
  stroke(grid, { x: a.x + 1, y: a.y + 1 }, { x: a.x + 4, y: a.y + 2 }, 1, metal);
  fillRect(grid, a.x - 1, a.y + 2, 6, 1, metalDark);
  setPixel(grid, a.x + 5, a.y + 2, near ? M.metalLight : M.metalShadow);
  setPixel(grid, a.x - 2, a.y + 2, metalDark);
};

/** 卵形の操縦席。幅を砲塔に合わせて ±11 に縮める。後ろにサブ武器を載せる金属の荷台と排気管 */
const cockpit = (dy: number, wrecked: boolean): PixelGrid => {
  const body = createGrid(-18, -14 + dy, 34, 8);
  rows(body, [[-13, -8, 8, A], [-12, -10, 10, C], [-11, -11, 11, C], [-10, -10, 10, E], [-9, -8, 8, F]], dy);
  // 前の目のセンサーと覗き窓、後ろの吸気口
  dots(body, [[8, -11, M.lamp], [9, -11, M.lamp], [10, -11, M.metalLight], [9, -10, M.metalShadow], [5, -11, M.hole], [6, -11, M.hole],
    [-9, -11, M.hole], [-9, -10, M.hole], [-7, -11, M.hole], [-7, -10, M.hole]], dy);
  fillRect(body, -15, -12 + dy, 5, 1, M.metalBase);
  fillRect(body, -15, -11 + dy, 5, 1, M.metalShadow);
  setPixel(body, -12, -10 + dy, M.metalDeep);
  // 荷台の後ろの排気管。煙がサブ武器（x ≥ −15）に重ならないよう、さらに後ろで上へ向ける
  fillRect(body, -17, -11 + dy, 2, 1, M.metalShadow);
  setPixel(body, -17, -12 + dy, M.metalDeep);
  // 残骸は装甲を欠き、熾火を胴の上に置く（胴が細いので、ほかのフレームの wreckChips の点では外へ浮く）
  if (wrecked) {
    for (let x = 2; x < 6; x++) setPixel(body, x, -13 + dy, -1);
    dots(body, [[-6, -10, M.ember], [2, -12, M.ember], [6, -9, M.ember], [-8, -11, M.ember]], dy);
  }
  return body;
};

export const reverseJointFrame = (phase: number, sink: number, wrecked: boolean): FrameParts => {
  const dy = sink + (wrecked ? 4 : 0);
  const far = createGrid(-24, -16, 48, 17), near = createGrid(-24, -16, 48, 17);
  for (const pose of reverseLegPoses(phase, dy, wrecked)) leg(pose.near ? near : far, pose);
  return { under: [{ mask: far, outline: true }], hull: cockpit(dy, wrecked), over: [{ mask: near, outline: true }] };
};
