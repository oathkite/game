import { fireAngle } from "@game/sim";
import { PALETTE, type Ramp } from "./palette";
import { composeLayers, createGrid, mirrorGrid, rotateGrid, setPixel, TRANSPARENT, type Edges, type Layer, type PixelGrid, type Rect } from "./pixelGrid";
import { flashColorAt, type Spark } from "./tankFlash";
import { antennaMask, BARREL_PIVOT_UP, BARREL_PX, hullMask, MATERIAL, treadMask, turretMask } from "./tankShape";

// 機体のスプライトを姿勢から描き直す。設計書 40.5。
// 車体は右向きの形を左右反転し、傾きで回してから、砲身、発射光、火花を画面の向きで描き足す。
// 画素はすべて art px の格子に乗り、Container を回さない。

export type BarrelRim = "none" | "charge" | "hot";

export type TankSpriteInput = {
  readonly hull: Ramp;
  readonly turret: Ramp;
  readonly facing: 1 | -1;
  /** 車体の傾き（整数の度、右が高いと正） */
  readonly tilt: number;
  /** 仰角（度）。溜めの震えを足した値 */
  readonly elevation: number;
  /** 砲身が引っ込む量（art px） */
  readonly recoil: number;
  /** 車体が沈む量（art px） */
  readonly sink: number;
  /** 履帯を送った距離（art px） */
  readonly treadPhase: number;
  readonly white: boolean;
  readonly wrecked: boolean;
  readonly rim: BarrelRim;
  /** 発射光のコマ。null なら出さない */
  readonly flash: number | null;
  readonly sparks: readonly Spark[];
};

/** スプライトを描く枠。砲身と発射光と火花が全仰角、全傾きで収まる大きさ */
export const TANK_FRAME: Rect = { left: -44, top: -48, width: 88, height: 64 };

/** 残骸の砲身。付け根を砲塔の崩れた位置へ下げ、18 度垂らし、短くする（38 章 C5） */
const WRECK_PIVOT = { x: 2, y: -13 } as const;
const WRECK_DROOP = 18;
const WRECK_BARREL_PX = 12;

type Point = { readonly x: number; readonly y: number };

/** 車体の座標の点を、反転と傾きで画面の座標へ移す。点（画素の角）なので反転は x → −x */
const toScreen = (p: Point, facing: 1 | -1, tilt: number): Point => {
  const rad = (tilt * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
  const x = p.x * facing;
  return { x: x * c + p.y * s, y: -x * s + p.y * c };
};

export type BarrelGeometry = { readonly pivot: Point; readonly angle: number; readonly length: number };

/** 砲身の付け根（画面の art px）、画面の角度（度、右が 0 で反時計回り）、見えている長さ */
export const barrelGeometry = (input: TankSpriteInput): BarrelGeometry => {
  if (input.wrecked) {
    const pivot = toScreen(WRECK_PIVOT, input.facing, input.tilt);
    return { pivot, angle: input.facing === 1 ? input.tilt - WRECK_DROOP : 180 + input.tilt + WRECK_DROOP, length: WRECK_BARREL_PX };
  }
  const pivot = toScreen({ x: 0, y: -BARREL_PIVOT_UP + input.sink }, input.facing, input.tilt);
  return { pivot, angle: fireAngle(input.tilt, input.elevation, input.facing), length: BARREL_PX - input.recoil };
};

/** 砲身の向きの単位ベクトル（dir）と、画面の下側を向く法線（normal）。左向きは法線を裏返し、光の縁を上に保って左右対称に描く */
const axes = (angle: number, facing: 1 | -1) => {
  const rad = (angle * Math.PI) / 180;
  return { dir: { x: Math.cos(rad), y: -Math.sin(rad) }, normal: { x: facing * Math.sin(rad), y: facing * Math.cos(rad) } };
};

/** 砲口（画面の art px） */
export const muzzleTip = (input: TankSpriteInput): Point => {
  const { pivot, angle, length } = barrelGeometry(input);
  const { dir } = axes(angle, input.facing);
  return { x: pivot.x + dir.x * length, y: pivot.y + dir.y * length };
};

/** 砲身の画素。太さ 2、先端 3 px を 4 px に太くした砲口。付け根側は砲塔の下に隠れる */
export const barrelMask = (input: TankSpriteInput): PixelGrid => {
  const { pivot, angle, length } = barrelGeometry(input);
  const { dir, normal } = axes(angle, input.facing);
  const reach = Math.ceil(length + 3);
  const left = Math.floor(pivot.x) - reach, top = Math.floor(pivot.y) - reach;
  const grid = createGrid(left, top, reach * 2 + 1, reach * 2 + 1);
  const recoil = input.wrecked ? 0 : input.recoil;
  for (let y = top; y < top + grid.height; y++) for (let x = left; x < left + grid.width; x++) {
    const dx = x + 0.5 - pivot.x, dy = y + 0.5 - pivot.y;
    const u = dx * dir.x + dy * dir.y, v = dx * normal.x + dy * normal.y;
    if (u < -recoil || u >= length) continue;
    const brake = !input.wrecked && u >= length - 3;
    if (brake ? v < -2 || v >= 2 : v < -1 || v >= 1) continue;
    setPixel(grid, x, y, brake ? (v < 0 ? MATERIAL.brakeLight : MATERIAL.brakeShadow) : v < 0 ? (input.rim === "none" ? MATERIAL.barrelLight : MATERIAL.rim) : MATERIAL.barrelShadow);
  }
  return grid;
};

const MAX_CACHE = 256;
const bodyCache = new Map<string, readonly PixelGrid[]>();

/** 反転と傾きを済ませた履帯、車体、砲塔、アンテナ。色によらないので全機体で使い回す。使い回すので、返した格子は書き換えない */
const bodyMasks = (input: TankSpriteInput): readonly PixelGrid[] => {
  const phase = input.facing * input.treadPhase;
  // 転輪は 3 px ごとにコマを替え、履帯の輪（3 px）と端（2 px）と合わせて 6 px で一巡する
  const wheel = Math.floor(phase / 3);
  const key = `${input.facing}|${input.tilt}|${input.sink}|${((phase % 6) + 6) % 6}|${((wheel % 2) + 2) % 2}|${input.wrecked}`;
  const cached = bodyCache.get(key);
  if (cached) return cached;
  const local = [treadMask(phase, wheel, input.wrecked), hullMask(input.sink, input.wrecked), turretMask(input.sink, input.wrecked), ...(input.wrecked ? [] : [antennaMask(input.sink)])];
  const masks = local.map(mask => rotateGrid(input.facing === 1 ? mask : mirrorGrid(mask), input.tilt));
  if (bodyCache.size >= MAX_CACHE) bodyCache.clear();
  bodyCache.set(key, masks);
  return masks;
};

const livingColor = (m: number, hull: Ramp, turret: Ramp, rim: BarrelRim): number => {
  switch (m) {
    case MATERIAL.linkA: case MATERIAL.wheelRim: case MATERIAL.hatch: case MATERIAL.antenna: case MATERIAL.brakeLight: return PALETTE.metal1;
    case MATERIAL.linkB: case MATERIAL.hubB: case MATERIAL.brakeShadow: return PALETTE.metal2;
    case MATERIAL.treadInner: return PALETTE.metal3;
    case MATERIAL.hubA: case MATERIAL.rivet: return PALETTE.metal0;
    case MATERIAL.hullLight: return hull.light;
    case MATERIAL.hullBase: return hull.base;
    case MATERIAL.hullShadow: return hull.shadow;
    case MATERIAL.skirt: return hull.deep;
    case MATERIAL.lamp: return PALETTE.fire1;
    case MATERIAL.turretLight: case MATERIAL.antennaTip: return turret.light;
    case MATERIAL.turretBase: case MATERIAL.barrelLight: return turret.base;
    case MATERIAL.turretShadow: case MATERIAL.barrelShadow: return turret.shadow;
    case MATERIAL.turretDeep: return turret.deep;
    case MATERIAL.shine: return PALETTE.white;
    case MATERIAL.rim: return rim === "hot" ? PALETTE.fire2 : PALETTE.greenLight;
    default: return PALETTE.smoke2;
  }
};

const wreckColor = (m: number): number => {
  switch (m) {
    case MATERIAL.hullLight: case MATERIAL.turretLight: return PALETTE.smoke1;
    case MATERIAL.hullBase: case MATERIAL.turretBase: case MATERIAL.barrelLight: return PALETTE.smoke2;
    case MATERIAL.ember: return PALETTE.fire5;
    default: return PALETTE.smoke3;
  }
};

/** 材質と縁から色を決める。回した後の画面の上の縁は、車体と砲塔の基準色を光の色にして輪郭を立てる */
const painter = (input: TankSpriteInput) => (m: number, edges: Edges): number => {
  if (input.white) return PALETTE.white;
  if (input.wrecked) return wreckColor(m);
  if (edges.top && m === MATERIAL.hullBase) return input.hull.light;
  if (edges.top && m === MATERIAL.turretBase) return input.turret.light;
  return livingColor(m, input.hull, input.turret, input.rim);
};

/** 発射光と火花の画素。画面の色をそのまま置く */
const effectGrid = (input: TankSpriteInput): PixelGrid => {
  const grid = createGrid(TANK_FRAME.left, TANK_FRAME.top, TANK_FRAME.width, TANK_FRAME.height);
  const tip = muzzleTip(input);
  const { dir, normal } = axes(barrelGeometry(input).angle, input.facing);
  if (input.flash !== null) {
    for (let y = Math.floor(tip.y) - 9; y <= Math.floor(tip.y) + 9; y++) for (let x = Math.floor(tip.x) - 9; x <= Math.floor(tip.x) + 9; x++) {
      const dx = x + 0.5 - tip.x, dy = y + 0.5 - tip.y;
      const color = flashColorAt(input.flash, dx * dir.x + dy * dir.y, dx * normal.x + dy * normal.y);
      if (color !== null) setPixel(grid, x, y, color);
    }
  }
  for (const s of input.sparks) {
    setPixel(grid, Math.floor(tip.x + s.u * dir.x + s.v * normal.x), Math.floor(tip.y + s.u * dir.y + s.v * normal.y), s.color);
  }
  return grid;
};

/** 姿勢から機体の絵を描く。TANK_FRAME の大きさの格子を返す */
export const composeTank = (input: TankSpriteInput): PixelGrid => {
  const [tread, hull, turret, antenna] = bodyMasks(input);
  const paint = painter(input);
  const outlined = (mask: PixelGrid): Layer => ({ mask, outline: PALETTE.outline, paint });
  const layers: Layer[] = [outlined(tread!), outlined(hull!), outlined(barrelMask(input)), outlined(turret!)];
  if (antenna) layers.push({ mask: antenna, outline: null, paint });
  if (input.flash !== null || input.sparks.length > 0) layers.push({ mask: effectGrid(input), outline: null, paint: (color) => (color === TRANSPARENT ? TRANSPARENT : color) });
  return composeLayers(layers, TANK_FRAME);
};
