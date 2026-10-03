import type { FrameSkin, TurretSkin, WeaponId } from "@game/protocol";
import { fireAngle } from "@game/sim";
import { frameParts, hullTop } from "./frameSkins";
import type { FrameLayer } from "./frameDraw";
import { PALETTE, type Ramp } from "./palette";
import { composeLayers, createGrid, mirrorGrid, rotateGrid, setPixel, TRANSPARENT, type Layer, type PixelGrid, type Rect } from "./pixelGrid";
import { flashColorAt, type Spark } from "./tankFlash";
import { barrelPainter, tankPainter, type BarrelRim } from "./tankPaint";
import { antennaMask, BARREL_PIVOT_UP, BARREL_PX } from "./tankShape";
import { TURRET_ART, turretGrid } from "./turretSkins";
import { BARREL_ART, subWeaponGrid } from "./weaponMounts";

// 機体のスプライトを姿勢から描き直す。設計書 40.5 と 43。
// 車体は右向きの形を左右反転し、傾きで回してから、砲身、発射光、火花を画面の向きで描き足す。
// 画素はすべて art px の格子に乗り、Container を回さない。

export type { BarrelRim } from "./tankPaint";

export type TankSpriteInput = {
  /** 主色（カラー 1）。車体を塗る */
  readonly hull: Ramp;
  /** 副色（カラー 2）。砲塔と砲身を塗る */
  readonly turret: Ramp;
  /** 砲塔のスキン */
  readonly turretSkin: TurretSkin;
  /** 車体と足回りを一体にしたフレームのスキン */
  readonly frame: FrameSkin;
  /** 撃つ武器。砲身の形になる */
  readonly weapon: WeaponId;
  /** もう一方の武器。車体後部に載せる。null なら載せない */
  readonly sub: WeaponId | null;
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
  /** アンテナの先端の横のずれ（art px）。省略は 0 */
  readonly antenna?: number;
  /** 時刻で進むコマ（浮遊の噴射の揺らぎ）。省略は 0 */
  readonly beat?: number;
};

/** スプライトを描く枠。砲身と発射光と火花が全仰角、全傾きで収まり、±45 度に傾けた幅の広いフレームの角が接地点より下へ回り込んでも切れない大きさ */
export const TANK_FRAME: Rect = { left: -52, top: -60, width: 104, height: 84 };

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

/** 砲身の画素。武器ごとの形を、付け根からの距離 u と砲身の下側への距離 v で描く。付け根側は砲塔の後ろに隠れる */
export const barrelMask = (input: TankSpriteInput): PixelGrid => {
  const art = BARREL_ART[input.weapon];
  const { pivot, angle, length } = barrelGeometry(input);
  const { dir, normal } = axes(angle, input.facing);
  const reach = Math.ceil(length + art.reach + 2);
  const left = Math.floor(pivot.x) - reach, top = Math.floor(pivot.y) - reach;
  const grid = createGrid(left, top, reach * 2 + 1, reach * 2 + 1);
  const recoil = input.wrecked ? 0 : input.recoil;
  for (let y = top; y < top + grid.height; y++) for (let x = left; x < left + grid.width; x++) {
    const dx = x + 0.5 - pivot.x, dy = y + 0.5 - pivot.y;
    const u = dx * dir.x + dy * dir.y, v = dx * normal.x + dy * normal.y;
    if (u < -recoil || u >= length) continue;
    // 反動で砲身全体が後ろへ下がる。飾りの位置は砲身の後端から数え、全長は反動の前の長さで渡す
    const m = art.profile(u + recoil, v, length + recoil);
    if (m !== null) setPixel(grid, x, y, m);
  }
  return grid;
};

type BodyMasks = {
  readonly under: readonly FrameLayer[];
  readonly turret: PixelGrid;
  readonly antenna: PixelGrid | null;
  readonly hull: PixelGrid;
  readonly sub: PixelGrid | null;
  readonly over: readonly FrameLayer[];
};

const MAX_CACHE = 256;
const bodyCache = new Map<string, BodyMasks>();

/** 浮遊の噴射だけが時刻で揺らぐ。ほかのフレームは beat で描き直さない */
const beatOf = (input: TankSpriteInput): number => (input.frame === "hover" ? input.beat ?? 0 : 0);

const bodyKey = (input: TankSpriteInput): string =>
  `${input.facing}|${input.tilt}|${input.sink}|${input.facing * input.treadPhase}|${input.wrecked}|${input.antenna ?? 0}|${input.turretSkin}|${input.frame}|${input.sub}|${beatOf(input)}`;

/** 反転と傾きを済ませたフレーム、砲塔、アンテナ、サブ武器。色によらないので全機体で使い回す。使い回すので、返した格子は書き換えない */
const bodyMasks = (input: TankSpriteInput): BodyMasks => {
  const key = bodyKey(input);
  const cached = bodyCache.get(key);
  if (cached) return cached;
  const place = (mask: PixelGrid) => rotateGrid(input.facing === 1 ? mask : mirrorGrid(mask), input.tilt);
  const placeLayer = (layer: FrameLayer): FrameLayer => ({ mask: place(layer.mask), outline: layer.outline });
  const parts = frameParts(input.frame, input.facing * input.treadPhase, beatOf(input), input.sink, input.wrecked);
  const art = TURRET_ART[input.turretSkin];
  const masks: BodyMasks = {
    under: parts.under.map(placeLayer),
    turret: place(turretGrid(input.turretSkin, input.sink, input.wrecked)),
    antenna: input.wrecked ? null : place(antennaMask(input.sink - art.antennaLift, input.antenna ?? 0)),
    hull: place(parts.hull),
    sub: input.sub && !input.wrecked ? place(subWeaponGrid(input.sub, input.sink, x => hullTop(parts.hull, x))) : null,
    over: parts.over.map(placeLayer),
  };
  if (bodyCache.size >= MAX_CACHE) bodyCache.clear();
  bodyCache.set(key, masks);
  return masks;
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

/**
 * 姿勢から機体の絵を描く。TANK_FRAME の大きさの格子を返す。
 * 奥から 足回りの奥の部品 → 砲身 → 砲塔 → アンテナ → 車体 → サブ武器 → 足回りの手前の部品 → 発射光の順に重ね、
 * 砲身の付け根は砲塔の後ろに、砲塔の下端は車体の後ろに隠れる
 */
export const composeTank = (input: TankSpriteInput): PixelGrid => {
  const masks = bodyMasks(input);
  const paint = tankPainter(input);
  const outlined = (mask: PixelGrid): Layer => ({ mask, outline: PALETTE.outline, paint });
  const part = (layer: FrameLayer): Layer => (layer.outline ? outlined(layer.mask) : { mask: layer.mask, outline: null, paint });
  const layers: Layer[] = [
    ...masks.under.map(part),
    { mask: barrelMask(input), outline: PALETTE.outline, paint: barrelPainter(input) },
    outlined(masks.turret),
    ...(masks.antenna ? [{ mask: masks.antenna, outline: null, paint }] : []),
    outlined(masks.hull),
    ...(masks.sub ? [outlined(masks.sub)] : []),
    ...masks.over.map(part),
  ];
  if (input.flash !== null || input.sparks.length > 0) layers.push({ mask: effectGrid(input), outline: null, paint: (color) => (color === TRANSPARENT ? TRANSPARENT : color) });
  return composeLayers(layers, TANK_FRAME);
};
