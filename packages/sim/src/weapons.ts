import type { WeaponId } from "@game/protocol";
import { BLAST_RADIUS, DAMAGE_MAX, DAMAGE_PER_CELL } from "./constants.js";

// 武器ごとの物理の数値。設計書 10 の 10.2。標準砲は設計書 01 と 06 の初期値そのままで、他は標準砲からの倍率で定める。
// 倍率は百分率の整数で持ち、初速と重力と風は整数除算（切り捨て）で換算する。浮動小数点を持ち込まない。

/** 着弾 1 段ぶんの数値。1 段しかない武器は 1 要素 */
export type StageSpec = {
  /** 爆風半径（セル）。地形を削る半径でもある */
  readonly blastRadius: number;
  /** 着弾距離 0 のダメージ */
  readonly damageMax: number;
  /** 着弾距離 1 セルあたりの減衰 */
  readonly damagePerCell: number;
};

/** 扇の 1 本。仰角のずれ（度、砲を上げる向きが正）と初速の倍率（%）。角度と初速を同じ向きにずらすと、低い仰角では前後に広がり、高い仰角（背面打ち）では 1 か所に集まる */
export type FanSpec = {
  readonly deg: number;
  readonly speedPercent: number;
};

export type WeaponSpec = {
  /** 弾道ごとのずれ。長さが弾道の本数で、順に発射する。1 発の武器は [{ deg: 0, speedPercent: 100 }] */
  readonly fan: readonly FanSpec[];
  /** 同じ角度を時間差で辿る発数。マルチ弾は 3 */
  readonly volleys: number;
  /** 着弾の段。着弾のたびに次の段へ進み、最後の段で止まる */
  readonly stages: readonly StageSpec[];
  /** 初速の倍率（%）。パワー 100 のときの初速に掛ける */
  readonly speedPercent: number;
  /** 重力の倍率（%） */
  readonly gravityPercent: number;
  /** 風の作用の倍率（%） */
  readonly windPercent: number;
};

const single = (blastRadius: number, damageMax: number, damagePerCell: number): readonly StageSpec[] => [{ blastRadius, damageMax, damagePerCell }];

const STRAIGHT: FanSpec = { deg: 0, speedPercent: 100 };
const ONE_SHOT = { fan: [STRAIGHT], volleys: 1 } as const;
/**
 * 3 本の扇。1 本目は砲を上げて速く（遠く）、3 本目は下げて遅く（手前）。
 * 到達距離は初速の 2 乗と sin(2θ) に比例するので、θ が 45 度未満では角度と初速の効果が足し合わされて前後に広がり、
 * 45 度を超えると打ち消し合う。±4 度・±5% では連続の式で約 63 度、離散の物理では仰角 60 度前後で 3 本が最も集まる。背面打ちで 1 か所に集める技になる
 */
const TRIPLE_FAN: readonly FanSpec[] = [
  { deg: 4, speedPercent: 105 },
  STRAIGHT,
  { deg: -4, speedPercent: 95 },
];
const STANDARD_FLIGHT = { speedPercent: 100, gravityPercent: 100, windPercent: 100 } as const;

export const WEAPON_SPECS: Readonly<Record<WeaponId, WeaponSpec>> = {
  cannon: { ...ONE_SHOT, stages: single(BLAST_RADIUS, DAMAGE_MAX, DAMAGE_PER_CELL), ...STANDARD_FLIGHT },
  // 3 発が前後に散る。1 発は標準砲の 3 等分より少し強く、至近か背面打ちで揃えば標準砲を超える
  triple: { fan: TRIPLE_FAN, volleys: 1, stages: single(6, 15, 3), ...STANDARD_FLIGHT },
  // 小さな 9 発。3 本の線を 3 発ずつが時間差で辿る。1 本命中で 15 とトリプル弾と同じ期待値
  multiple: { fan: TRIPLE_FAN, volleys: 3, stages: single(3, 5, 2), ...STANDARD_FLIGHT },
  // 着弾しても止まらず 3 段掘り進む。段ごとに半径とダメージが小さくなる
  drill: {
    ...ONE_SHOT,
    stages: [
      { blastRadius: 8, damageMax: 22, damagePerCell: 3 },
      { blastRadius: 6, damageMax: 14, damagePerCell: 3 },
      { blastRadius: 4, damageMax: 8, damagePerCell: 3 },
    ],
    ...STANDARD_FLIGHT,
  },
  // 重力が軽く伸びる弾が 5 段抜けて線のように削る。風の作用は標準のまま（風を読む遊びから外さない）。
  // 爆風は当初 2 だったが、遠くまで飛ぶぶん当てにくいので 3 に広げた（針弾と同じ）。
  // 到達距離は初速の 2 乗を重力で割った値に比例するので、重力 70% で標準砲の 1.4 倍ほど伸びる。初速も上げると届きすぎる
  laser: { ...ONE_SHOT, stages: Array.from({ length: 5 }, () => ({ blastRadius: 3, damageMax: 8, damagePerCell: 4 })), speedPercent: 100, gravityPercent: 70, windPercent: 100 },
  // 地形を崩す道具。爆風は当初 16 だったが、個性を強めるため 18 に広げた。ダメージは据え置き
  digger: { ...ONE_SHOT, stages: single(18, 16, 1), speedPercent: 90, gravityPercent: 100, windPercent: 100 },
  // 風 200% で最も当てにくいので、当初の 25 / 半径 8 から 30 / 半径 10 に上げた。標準砲の 35 は超えない
  floater: { ...ONE_SHOT, stages: single(10, 30, 2), speedPercent: 70, gravityPercent: 50, windPercent: 200 },
  stinger: { ...ONE_SHOT, stages: single(3, 55, 15), speedPercent: 105, gravityPercent: 100, windPercent: 100 },
};

export const weaponSpec = (weapon: WeaponId): WeaponSpec => WEAPON_SPECS[weapon];

/** 最初の段。爆風半径や直撃ダメージを 1 つの値として扱いたいときに使う */
export const firstStage = (weapon: WeaponId): StageSpec => WEAPON_SPECS[weapon].stages[0] as StageSpec;

/** 1 発の射撃で飛ぶ弾道の本数（扇の本数 × 発数） */
export const projectileCount = (spec: WeaponSpec): number => spec.fan.length * spec.volleys;

/** 全弾が全段で直撃したときのダメージの合計。バランスの目安 */
export const fullHitDamage = (spec: WeaponSpec): number => projectileCount(spec) * spec.stages.reduce((sum, s) => sum + s.damageMax, 0);

/** 百分率を掛けて切り捨てる。初速、重力、風の換算に使う */
export const scalePercent = (value: number, percent: number): number => Math.trunc((value * percent) / 100);
