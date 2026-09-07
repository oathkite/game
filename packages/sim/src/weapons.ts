import type { WeaponId } from "@game/protocol";
import { BLAST_RADIUS, DAMAGE_MAX, DAMAGE_PER_CELL } from "./constants.js";

// 武器ごとの物理の数値。設計書 10 の 10.2。標準砲は設計書 01 と 06 の初期値そのままで、他は標準砲からの倍率で定める。
// 倍率は百分率の整数で持ち、初速と重力と風は整数除算（切り捨て）で換算する。浮動小数点を持ち込まない。

export type WeaponSpec = {
  /** 爆風半径（セル）。地形を削る半径でもある */
  readonly blastRadius: number;
  /** 着弾距離 0 のダメージ */
  readonly damageMax: number;
  /** 着弾距離 1 セルあたりの減衰 */
  readonly damagePerCell: number;
  /** 初速の倍率（%）。パワー 100 のときの初速に掛ける */
  readonly speedPercent: number;
  /** 重力の倍率（%） */
  readonly gravityPercent: number;
  /** 風の作用の倍率（%） */
  readonly windPercent: number;
};

export const WEAPON_SPECS: Readonly<Record<WeaponId, WeaponSpec>> = {
  // メイン
  cannon: { blastRadius: BLAST_RADIUS, damageMax: DAMAGE_MAX, damagePerCell: DAMAGE_PER_CELL, speedPercent: 100, gravityPercent: 100, windPercent: 100 },
  heavy: { blastRadius: 13, damageMax: 45, damagePerCell: 3, speedPercent: 85, gravityPercent: 100, windPercent: 100 },
  sniper: { blastRadius: 6, damageMax: 40, damagePerCell: 6, speedPercent: 115, gravityPercent: 100, windPercent: 50 },
  // サブ
  digger: { blastRadius: 16, damageMax: 16, damagePerCell: 1, speedPercent: 90, gravityPercent: 100, windPercent: 100 },
  floater: { blastRadius: 8, damageMax: 25, damagePerCell: 2, speedPercent: 70, gravityPercent: 50, windPercent: 200 },
  stinger: { blastRadius: 3, damageMax: 55, damagePerCell: 15, speedPercent: 105, gravityPercent: 100, windPercent: 100 },
};

export const weaponSpec = (weapon: WeaponId): WeaponSpec => WEAPON_SPECS[weapon];

/** 百分率を掛けて切り捨てる。初速、重力、風の換算に使う */
export const scalePercent = (value: number, percent: number): number => Math.trunc((value * percent) / 100);
