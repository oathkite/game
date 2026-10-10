import type { WeaponId } from "@game/protocol";
import { createGrid, setPixel, type PixelGrid } from "./pixelGrid";
import { MATERIAL as M } from "./tankShape";
import { sketch } from "./turretSkins";

// 武器の見た目。設計書 43。撃つ武器を砲身に、もう一方の武器を車体後部のサブ武器に描く。
// 砲身は付け根からの距離 u と、砲身の下側への距離 v で材質を返す関数で描き、仰角と傾きで回しても形が崩れないようにする。

/** 砲身の 1 画素。u は砲身の後端から先へ、v は砲身の下側へ（負が上の縁）。length は反動の前の長さ。null は砲身の外 */
export type BarrelProfile = (u: number, v: number, length: number) => number | null;
export type BarrelArt = { readonly profile: BarrelProfile; /** 太さの最大（|v|） */ readonly reach: number };

const upper = (v: number) => (v < 0 ? M.barrelLight : M.barrelShadow);
const within = (v: number, half: number) => v >= -half && v < half;

export const BARREL_ART: Readonly<Record<WeaponId, BarrelArt>> = {
  // 中ほどに排煙器のふくらみ、先に 2 枚の板の砲口制退器
  cannon: { reach: 2, profile: (u, v, length) => {
    if (u >= length - 1 || (u >= length - 3 && u < length - 2)) return within(v, 2) ? (v < 0 ? M.brakeLight : M.brakeShadow) : null;
    if (u >= 7 && u < 10 && v >= -1.5 && v < 1.5) return v < -1 ? M.barrelLight : v < 0 ? M.turretBase : M.barrelShadow;
    return within(v, 1) ? upper(v) : null;
  } },
  // 付け根の覆いと 2 つの帯で束ねた 3 本の管
  triple: { reach: 4, profile: (u, v, length) => {
    if (u < 6 && within(v, 3.5)) return v < -2.5 ? M.barrelLight : v >= 2.5 ? M.turretDeep : v < 0 ? M.turretBase : M.barrelShadow;
    if (u >= 11 && u < 12 && within(v, 3)) return v < 0 ? M.metalBase : M.metalShadow;
    const tube = within(v, 1) || (v >= -3 && v < -2) || (v >= 2 && v < 3);
    if (!tube) return null;
    return u >= length - 1 ? M.metalLight : upper(v);
  } },
  // 箱形のミサイル発射機。上に案内のレール、先の面から 3 発の弾頭
  multiple: { reach: 5, profile: (u, v, length) => {
    if (u < 3) return within(v, 1) ? M.metalShadow : null;
    if (u >= 5 && u < 11 && v >= -5 && v < -4) return M.metalShadow;
    if (!within(v, 4)) return null;
    const lane = [-3, 0, 3].find(center => within(v - center, 1));
    if (u >= length - 2) {
      if (lane === undefined) return null;
      if (u < length - 1) return M.metalLight;
      return v < lane ? M.warhead : M.warheadShadow;
    }
    if (u >= length - 3) return lane === undefined ? M.metalShadow : M.metalDeep;
    if (u >= 7 && u < 8) return M.metalBase;
    if (v < -3) return M.barrelLight;
    if (v >= 3) return M.turretDeep;
    return v < 0 ? M.turretBase : M.barrelShadow;
  } },
  // 通気口のある太いモーター部から、ねじれた刃の円錐
  drill: { reach: 4, profile: (u, v, length) => {
    const cone = 8;
    if (u >= length - cone) {
      const half = (2.6 * (length - u)) / cone + 0.7;
      if (Math.abs(v) >= half) return null;
      const band = ((Math.floor((u + v * 1.2) / 1.5) % 2) + 2) % 2;
      return band === 0 ? (v < 0 ? M.metalLight : M.metalBase) : M.metalDeep;
    }
    if (u >= 2 && within(v, 2.5)) {
      if (Math.floor(u) % 2 === 0 && within(v, 1.5)) return M.metalDeep;
      return v < -1.5 ? M.barrelLight : v >= 1.5 ? M.turretDeep : v < 0 ? M.turretBase : M.barrelShadow;
    }
    return within(v, 1) ? upper(v) : null;
  } },
  // 2 本のレールの間を光が走るレールガン。レールを渡す 2 つの枠
  laser: { reach: 3, profile: (u, v, length) => {
    if (u < 4) return within(v, 2) ? (v < -1 ? M.barrelLight : v < 0 ? M.turretBase : M.barrelShadow) : null;
    if (v >= -3 && v < -2) return M.metalLight;
    if (v >= 2 && v < 3) return M.metalShadow;
    if ((u >= 7 && u < 8) || (u >= 11 && u < 12)) return within(v, 2) ? M.metalDeep : null;
    // レールの間は暗く抜き、中央の光の筋だけを明るくする
    if (within(v, 1)) return u >= length - 1.5 || v < 0 ? M.energyHot : M.energyCore;
    if (within(v, 2)) return M.hole;
    return null;
  } },
  // 太い迫撃砲。補強の輪と、ラッパに開く口
  digger: { reach: 4, profile: (u, v, length) => {
    if (u >= length - 3) {
      const half = 2.5 + (u - (length - 3)) * 0.6;
      return within(v, half) ? (v < -half + 1 ? M.metalLight : v >= half - 1 ? M.metalDeep : M.metalShadow) : null;
    }
    if (!within(v, 2.5)) return null;
    if ((u >= 4 && u < 5) || (u >= 8 && u < 9)) return v < 0 ? M.metalBase : M.metalShadow;
    return v < -1.5 ? M.barrelLight : v >= 1.5 ? M.turretDeep : v < 0 ? M.turretBase : M.barrelShadow;
  } },
  // ばねで弾き出す太く短い砲身。胴にコイルを 3 巻き、先に広い口
  bouncer: { reach: 3, profile: (u, v, length) => {
    if (u >= length - 1.5) return within(v, 3) ? (v < 0 ? M.brakeLight : M.brakeShadow) : null;
    if ([4, 6, 8].some(c => u >= c && u < c + 1) && within(v, 2.5)) return v < 0 ? M.metalBase : M.metalShadow;
    return within(v, 2) ? upper(v) : null;
  } },
  // 狙撃銃。照準のレール、細い針の銃身、先に減音器
  stinger: { reach: 2, profile: (u, v, length) => {
    if (u < 4) return within(v, 1) ? upper(v) : null;
    if (u < 9 && v >= -2 && v < -1) return M.metalShadow;
    if (u >= length - 5) {
      if (!within(v, 1)) return null;
      return Math.floor(u) % 2 === 0 ? M.metalDeep : v < 0 ? M.metalLight : M.metalBase;
    }
    if (within(v, 0.5)) return M.barrelLight;
    return null;
  } },
};

/** サブ武器の図。6 列 6 行で、下端の行を車体の後部（y = −14、x = −14〜−9）に置く */
const SUB_WEAPON_ART: Readonly<Record<WeaponId, readonly string[]>> = {
  // 予備の砲弾の箱
  cannon: [
    ".yy.yy",
    ".YY.YY",
    "nnnnnn",
    "nooooo",
    "nooooo",
    "pppppp",
  ],
  // 立てた 3 発の砲弾
  triple: [
    "y.y.y.",
    "Y.Y.Y.",
    "Y.Y.Y.",
    "Z.Z.Z.",
    "nnnnnn",
    "pppppp",
  ],
  // ミサイルの小箱。前から 2 発の弾頭
  multiple: [
    "nnnnn.",
    "nmmmmr",
    "nnnnn.",
    "nmmmmr",
    "nnnnn.",
    "pppppp",
  ],
  // 上を向いた予備の刃
  drill: [
    "..m...",
    "..mo..",
    ".omo..",
    ".momo.",
    "omomo.",
    "pppppp",
  ],
  // 光る電池
  laser: [
    ".n..n.",
    "nnnnnn",
    "neccdn",
    "neccdn",
    "nnnnnn",
    "pppppp",
  ],
  // 導火線つきの黒い爆弾
  digger: [
    "....s.",
    "...f..",
    ".kkk..",
    "kKkkk.",
    "kkkkk.",
    "pkkkpp",
  ],
  // ばねに載せた予備の球
  bouncer: [
    ".LBB..",
    "LwBBS.",
    "BBBSD.",
    ".SDD..",
    "n.n.n.",
    "pppppp",
  ],
  // 針の矢筒
  stinger: [
    "m.m.m.",
    "n.n.n.",
    "n.n.n.",
    "YYYYYY",
    "YZZZZY",
    "ZZZZZZ",
  ],
};

/** サブ武器の左端の x。どの砲塔でも同じ位置に載せる */
const SUB_LEFT = -15;

/** サブ武器。図の下端を y = −14 に置き、車体の上の縁まで 2 本の脚で支える。topOf は列ごとの車体の上の縁 */
export const subWeaponGrid = (weapon: WeaponId, sink: number, topOf: (x: number) => number): PixelGrid => {
  const rows = SUB_WEAPON_ART[weapon];
  const art = sketch(SUB_LEFT, -14 - rows.length + 1, rows, 0, sink);
  const out = createGrid(SUB_LEFT, art.top, 6, rows.length + 10);
  out.pixels.set(art.pixels);
  // 車体の縁が低い列ほど長い脚になる
  for (const x of [SUB_LEFT + 1, SUB_LEFT + 3]) for (let y = -13 + sink; y < topOf(x); y++) setPixel(out, x, y, M.metalDeep);
  return out;
};
