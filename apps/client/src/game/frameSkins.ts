import type { FrameSkin } from "@game/protocol";
import { createGrid, fillRect, getPixel, setPixel, type PixelGrid } from "./pixelGrid";
import { A, bigWheel, C, dots, E, F, inPolygon, mod, rows, stoneWheel, stroke, wreckChips, type FrameParts, type Point } from "./frameDraw";
import { hullMask, MATERIAL as M, treadMask } from "./tankShape";
import { walkerFrame } from "./walkerFrame";

// フレームのスキン。設計書 43。車体と足回りを一体にした形で、主色の車体ごと変わる。
// 動かさないもの: 砲塔の位置（砲身の付け根は接地点の 16 px 上）と接地点。当たり判定（半径 3 セル）は形によらず同じ。
// phase は進んだ距離（art px）、beat は時刻で進むコマ（浮遊の噴射の揺らぎ）。

// ---- キャタピラ（基準。今の形のまま） ----
const tracks = (phase: number, sink: number, wrecked: boolean): FrameParts => {
  const base = hullMask(sink, wrecked);
  const hull = createGrid(-17, -13 + sink, 34, 8);
  for (let y = base.top; y < base.top + base.height; y++) for (let x = base.left; x < base.left + base.width; x++) {
    const m = getPixel(base, x, y);
    if (m !== -1) setPixel(hull, x, y, m);
  }
  // 履帯の上の側面装甲。3 枚に区切り、板ごとに鋲。前に泥よけ
  for (const [from, to] of [[-15, -6], [-5, 4], [5, 14]] as const) {
    fillRect(hull, from, -6 + sink, to - from, 1, E);
    setPixel(hull, from + 1, -6 + sink, M.rivet);
  }
  fillRect(hull, 14, -7 + sink, 2, 1, E);
  fillRect(hull, 15, -6 + sink, 1, 2, M.metalShadow);
  return { under: [{ mask: treadMask(phase, Math.floor(phase / 3), wrecked), outline: true }], hull, over: [] };
};

// ---- 大型キャタピラ。菱形の履帯が車体の外周を回り、前が高く跳ね上がる ----
const RHOMBUS: readonly Point[] = [
  { x: -22, y: -8 }, { x: -18, y: -12 }, { x: 10, y: -12 }, { x: 19, y: -17 }, { x: 24, y: -13 }, { x: 23, y: -8 }, { x: 15, y: 0 }, { x: -15, y: 0 },
];
const BAND = 3;
const bigTracks = (phase: number, sink: number, wrecked: boolean): FrameParts => {
  const band = createGrid(-23, -18, 48, 19);
  const panel = createGrid(-23, -18 + sink, 48, 19);
  const inside = (x: number, y: number) => inPolygon(RHOMBUS, x + 0.5, y + 0.5);
  const depth = (x: number, y: number): number => {
    for (let k = 1; k <= BAND; k++) for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) if (!inside(x + dx, y + dy)) return k;
    return BAND + 1;
  };
  for (let y = -18; y <= 0; y++) for (let x = -23; x < 25; x++) {
    if (!inside(x, y)) continue;
    const k = depth(x, y);
    if (k > BAND) {
      // 側面の装甲板。上を明るく、下へ暗く
      setPixel(panel, x, y + sink, y <= -7 ? C : y <= -4 ? E : F);
      continue;
    }
    // 外周の 3 px が履帯。外の 1 px を 2 px ごとの板、中を地、内の 1 px を案内の溝。上の走りは進む向きへ、下は逆へ
    const run = y < -6 ? x - phase : x + phase;
    if (k === 1 && wrecked && mod(x * 3 + y, 7) === 0) continue;
    setPixel(band, x, y, k === 1 ? (mod(Math.floor((run + y) / 2), 2) === 0 ? M.linkA : M.linkB) : k === 2 ? M.treadInner : M.metalShadow);
  }
  // 上部構造は装甲板まで下ろし、上の走りは前後の跳ね上がりにだけ見せる
  rows(panel, [[-14, -10, 8, A], [-13, -12, 10, C], [-12, -13, 11, C], [-11, -14, 12, C], [-10, -15, 13, C]], sink);
  // 扉の枠と鋲、前の灯、後ろの銃眼
  for (let y = -8; y <= -3; y++) { setPixel(panel, -3, y + sink, E); setPixel(panel, 3, y + sink, E); }
  fillRect(panel, -3, -9 + sink, 7, 1, E);
  dots(panel, [...[-15, -10, 8, 13].map(x => [x, -7, M.rivet] as const), ...[-12, -7, 6, 11].map(x => [x, -3, M.rivet] as const), [0, -6, M.rivet],
    [18, -11, M.lamp], [19, -11, M.lamp], [-18, -7, M.hole], [-18, -6, M.hole]], sink);
  // 後ろの排気口
  fillRect(panel, -16, -15 + sink, 2, 2, M.metalShadow);
  fillRect(panel, -17, -16 + sink, 4, 1, M.metalDeep);
  if (wrecked) wreckChips(panel, -14, sink);
  return { under: [{ mask: band, outline: true }], hull: panel, over: [] };
};

// ---- 車輪。直径 10 のタイヤを前後に張り出し、懸架の腕とショックで車体を持ち上げる ----
const wheels = (phase: number, sink: number, wrecked: boolean): FrameParts => {
  const drop = wrecked ? 3 : 0;
  // 全長はキャタピラ（±15）に近い ±19 に収める。タイヤの中心は ±13
  const tires = createGrid(-20, -13, 40, 13);
  bigWheel(tires, -13, -6, 6, phase, wrecked);
  bigWheel(tires, 13, -6, 6, phase, false);
  const lift = sink + drop;
  const body = createGrid(-21, -18 + lift, 42, 14);
  // 懸架の腕とショック。車体の下から車輪の軸へ
  stroke(body, { x: -6, y: -8 + lift }, { x: -13, y: -6 + drop / 2 }, 2, M.metalShadow);
  stroke(body, { x: 5, y: -8 + lift }, { x: 13, y: -6 + drop / 2 }, 2, M.metalShadow);
  for (const x of [-10, 9]) fillRect(body, x, -12 + lift, 1, 4, M.metalLight);
  rows(body, [
    // 前後のフェンダーがタイヤを覆い、間を箱の車体でつなぐ
    [-14, -18, -8, A], [-14, 8, 18, A],
    [-13, -19, 19, C],
    [-12, -19, -16, C], [-12, -10, 10, C], [-12, 16, 19, C],
    [-11, -10, 11, C], [-10, -10, 10, E], [-9, -9, 9, E], [-8, -8, 8, F], [-7, -6, 6, M.metalShadow],
  ], lift);
  dots(body, [[17, -13, M.lamp], [16, -13, M.lamp], [19, -12, M.metalLight], [19, -11, M.metalShadow], [7, -12, M.hole], [8, -12, M.hole], [9, -11, M.hole],
    [-18, -12, M.hole], [-5, -13, A], [1, -13, A]], lift);
  // 前のフェンダーの上に補助灯のバー、後ろにスポイラー
  fillRect(body, 10, -16 + lift, 7, 1, M.metalDeep);
  for (const x of [11, 13, 15]) setPixel(body, x, -16 + lift, M.lamp);
  for (const x of [10, 16]) setPixel(body, x, -15 + lift, M.metalShadow);
  fillRect(body, -20, -17 + lift, 5, 1, A);
  fillRect(body, -19, -16 + lift, 1, 2, M.metalShadow);
  if (wrecked) wreckChips(body, -13, lift);
  return { under: [{ mask: tires, outline: true }], hull: body, over: [] };
};

// ---- 浮遊。両翼が張り出した円盤のガンシップ。底と翼端から噴射し、地面から浮いて上下に揺れる ----
/** 浮遊の上下の揺れ。beat の 8 コマで 1 往復し、車体を 0〜1 px 持ち上げる。砲口の位置を変えないよう、砲塔と砲身は揺らさない */
const hoverBob = (beat: number): number => (mod(beat, 8) < 4 ? 0 : 1);

/** 底と翼端の噴射。地面に届く手前で細って消え、地面には噴射の当たる光の波紋を置く */
const hoverGlow = (beat: number, up: number): PixelGrid => {
  const glow = createGrid(-25, -8, 50, 8);
  const flicker = mod(beat, 3);
  // 底の噴射。中央が白く、外へシアン。長さが揺らぐ
  for (const [i, half] of [4, 3, 2, 1].entries()) {
    const y = -7 + i - up;
    if (i === 3 && flicker === 0) continue;
    fillRect(glow, -half, y, half * 2, 1, i === 0 ? M.energyCore : M.energyDeep);
    if (half > 1) fillRect(glow, -half + 1, y, (half - 1) * 2, 1, M.energyHot);
  }
  for (const x of [-17, 15]) {
    fillRect(glow, x, -8 - up, 2, 1, M.energyHot);
    if (flicker !== 1) fillRect(glow, x, -7 - up, 2, 1, M.energyCore);
    if (flicker === 2) setPixel(glow, x + (x < 0 ? 0 : 1), -6 - up, M.energyDeep);
  }
  // 地面の波紋。噴射の真下から左右へ、コマごとに外へ広がる
  const ripple = mod(beat, 4);
  for (const side of [-1, 1]) {
    const from = 3 + ripple * 2;
    for (let k = 0; k < 3; k++) setPixel(glow, side < 0 ? -from - k - 1 : from + k, -1, ripple === 3 ? M.energyDeep : M.energyCore);
  }
  return glow;
};

const hover = (beat: number, sink: number, wrecked: boolean): FrameParts => {
  const drop = wrecked ? 4 : 0, up = wrecked ? 0 : hoverBob(beat);
  const dy = sink + drop - up;
  const body = createGrid(-25, -16 + dy, 50, 12);
  // 翼幅はキャタピラ（±15）に近い ±19 に収める。底を薄くして、地面との間に噴射の隙間を空ける
  rows(body, [
    [-13, -9, 7, A], [-12, -13, 11, C], [-11, -17, 16, C], [-10, -19, 19, C], [-9, -15, 15, E], [-8, -7, 7, F],
  ], dy);
  // 翼端の噴射口と、縁の灯、縦の安定翼
  fillRect(body, -17, -9 + dy, 2, 1, M.metalShadow);
  fillRect(body, 15, -9 + dy, 2, 1, M.metalShadow);
  for (const [x, dir] of [[-18, -1], [16, 1]] as const) {
    fillRect(body, x, -12 + dy, 2, 2, E);
    fillRect(body, x + (dir < 0 ? -1 : 1), -14 + dy, 2, 2, C);
    setPixel(body, x + (dir < 0 ? -2 : 3), -15 + dy, A);
  }
  dots(body, [-16, -11, -6, -1, 4, 9, 14].map(x => [x, -10, wrecked ? E : M.energyCore] as const), dy);
  dots(body, [[19, -10, A], [-16, -12, M.hole], [-15, -12, M.hole], [8, -12, M.energyHot], [9, -12, M.energyCore], [10, -12, M.energyDeep], [9, -13, M.energyHot]], dy);
  // 底の噴射口
  fillRect(body, -4, -8 + dy, 8, 1, M.metalDeep);
  if (!wrecked) fillRect(body, -2, -8 + dy, 4, 1, M.energyHot);
  // 残骸は噴射が止まって地面に落ち、潰れた底が地面に着く
  if (wrecked) rows(body, [[-7, -6, 6, F], [-6, -5, 4, M.metalDeep], [-5, -3, 2, M.metalDeep]], dy);
  if (wrecked) wreckChips(body, -13, dy);
  return { under: [], hull: body, over: wrecked ? [] : [{ mask: hoverGlow(beat, up), outline: false }] };
};

// ---- 石輪。原始時代の投擲機のような荷車。前後に大きな石の車輪を車体の手前に重ね、木の梁を縄で縛った台車。荷台の前後の壁で主色を見せる ----
const stoneWheels = (phase: number, sink: number, wrecked: boolean): FrameParts => {
  const drop = wrecked ? 2 : 0;
  // 奥の車輪は暗い石で、手前の車輪の少し前にずらして描く
  const far = createGrid(-20, -16, 40, 16);
  stoneWheel(far, -6, -7, 7, phase + 3, false);
  stoneWheel(far, 12, -7, 7, phase + 3, false);
  for (let y = -16; y <= 0; y++) for (let x = -20; x < 20; x++) if (getPixel(far, x, y) !== -1) setPixel(far, x, y, M.stoneDeep);
  const body = createGrid(-20, -18 + sink + drop, 42, 13);
  // 荷台。前後の壁を車輪より上まで立ち上げ、車輪を重ねても主色が見えるようにする
  rows(body, [
    [-17, -17, -12, A], [-17, 8, 14, A],
    [-16, -18, -11, C], [-16, 7, 15, C],
    [-15, -18, -11, C], [-15, 7, 16, C],
    [-14, -18, -10, C], [-14, 6, 16, C],
    [-13, -18, 16, C], [-12, -17, 16, C], [-11, -16, 16, C], [-10, -15, 15, E], [-9, -13, 13, E], [-8, -11, 11, F],
  ], sink + drop);
  // 壁の縁の木の枠と、壁を留める縄
  fillRect(body, -18, -17 + sink + drop, 1, 4, M.wood);
  fillRect(body, 15, -16 + sink + drop, 1, 3, M.wood);
  dots(body, [[-15, -15, M.brass], [-14, -15, M.brass], [11, -15, M.brass], [12, -15, M.brass]], sink + drop);
  // 台車の木の梁と、前へ突き出した丸太。縛った縄の跡
  fillRect(body, -17, -7 + sink + drop, 32, 1, M.wood);
  fillRect(body, -17, -6 + sink + drop, 32, 1, M.woodDark);
  fillRect(body, 14, -9 + sink + drop, 6, 2, M.wood);
  fillRect(body, 14, -9 + sink + drop, 6, 1, M.woodLight);
  for (const x of [-14, -4, 6, 14]) { setPixel(body, x, -7 + sink + drop, M.brass); setPixel(body, x, -6 + sink + drop, M.brassShadow); }
  // 丸太の先の骨の飾り
  dots(body, [[20, -10, M.bone], [20, -9, M.bone], [20, -8, M.bone], [21, -10, M.bone], [21, -8, M.bone]], sink + drop);
  dots(body, [[12, -11, M.lamp], [-11, -11, M.hole], [-11, -10, M.hole]], sink + drop);
  if (wrecked) wreckChips(body, -13, sink + drop);
  // 手前の車輪は前後とも車体より手前に描く
  const near = createGrid(-20, -16, 40, 16);
  stoneWheel(near, -9, -7, 7, phase, wrecked);
  stoneWheel(near, 9, -7, 7, phase, false);
  return { under: [{ mask: far, outline: true }], hull: body, over: [{ mask: near, outline: true }] };
};

/**
 * 待機中に煙を出す排気口（右向き、接地点からの art px）。浮遊は噴射の光があるので、石輪はエンジンが無いので煙を出さない。
 * キャタピラは tankMotion.ts の既定の位置と同じ
 */
export const EXHAUST_PORTS: Readonly<Record<FrameSkin, Point | null>> = {
  tracks: { x: -15, y: -7 }, bigTracks: { x: -16, y: -17 }, wheels: { x: -20, y: -12 }, walker: { x: -14, y: -11 }, hover: null, stoneWheels: null,
};

/** フレームの部品。phase は進んだ距離（art px）、beat は時刻のコマ */
export const frameParts = (id: FrameSkin, phase: number, beat: number, sink: number, wrecked: boolean): FrameParts => {
  switch (id) {
    case "tracks": return tracks(phase, sink, wrecked);
    case "bigTracks": return bigTracks(phase, sink, wrecked);
    case "wheels": return wheels(phase, sink, wrecked);
    case "walker": return walkerFrame(phase, sink, wrecked);
    case "hover": return hover(beat, sink, wrecked);
    case "stoneWheels": return stoneWheels(phase, sink, wrecked);
  }
};

/** 車体の上の縁の高さ（x の列で最も上の画素）。サブ武器の台を車体まで下ろすのに使う */
export const hullTop = (hull: PixelGrid, x: number): number => {
  for (let y = hull.top; y < hull.top + hull.height; y++) if (getPixel(hull, x, y) !== -1) return y;
  return 0;
};
