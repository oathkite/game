// 武器。設計書 10。候補と、画面に出す名前と説明。
// 物理の数値（爆風半径、ダメージ、初速の倍率、弾数、段数）は sim の weapons.ts に置く。ここには語彙だけを置く。

export const WEAPON_IDS = ["cannon", "triple", "multiple", "drill", "laser", "digger", "floater", "stinger"] as const;

export type WeaponId = (typeof WEAPON_IDS)[number];

/** 装備の 2 つのスロット。そのターンにどちらで撃つかを 0 か 1 で選ぶ */
export type WeaponSlot = 0 | 1;
export const WEAPON_SLOTS = [0, 1] as const;

/** プレイヤーが選ぶ 2 つの武器。組み合わせは自由だが、同じ武器を 2 つは選べない */
export type Loadout = readonly [WeaponId, WeaponId];

export const DEFAULT_LOADOUT: Loadout = ["cannon", "digger"];

export const WEAPON_LABELS: Readonly<Record<WeaponId, string>> = {
  cannon: "標準砲",
  triple: "トリプル弾",
  multiple: "マルチプル弾",
  drill: "貫通弾",
  laser: "レーザー弾",
  digger: "掘削弾",
  floater: "浮遊弾",
  stinger: "針弾",
};

/** 設定画面に出す一行の説明。数値は出さず、性格だけを伝える */
export const WEAPON_DESCRIPTIONS: Readonly<Record<WeaponId, string>> = {
  cannon: "癖のない基準の砲",
  triple: "3 発が前後に散る。高く撃ち上げれば 1 か所に集まる",
  multiple: "小さな 9 発。3 本の線を 3 発ずつ辿り、細かく削る",
  drill: "着弾しても止まらず、3 段掘り進む。直撃なら重い",
  laser: "軽く伸びる弾が 5 段抜けて線のように削る。風には流される",
  digger: "地形を大きく削る。機体にはほとんど効かない",
  floater: "ゆっくり飛び、風に強く流される",
  stinger: "爆風は針の穴ほど。直撃なら最大の一撃",
};

export const isWeaponId = (v: unknown): v is WeaponId => typeof v === "string" && (WEAPON_IDS as readonly string[]).includes(v);

/** 装備として成り立つか。2 つとも武器で、同じ武器を 2 つ選んでいない */
export const isValidLoadout = (loadout: readonly [WeaponId, WeaponId]): boolean => loadout[0] !== loadout[1];

/**
 * 保存された値から装備を読む。今の形（武器 2 つの組）と、最初の版の形（メインとサブの対）を受け付ける。
 * 削除した武器や同じ武器 2 つなど、装備として成り立たなければ null
 */
export const parseLoadout = (v: unknown): Loadout | null => {
  const pair: readonly [unknown, unknown] | null = Array.isArray(v) && v.length === 2 ? [v[0], v[1]] : isOldLoadout(v) ? [v.main, v.sub] : null;
  if (!pair || !isWeaponId(pair[0]) || !isWeaponId(pair[1]) || !isValidLoadout([pair[0], pair[1]])) return null;
  return [pair[0], pair[1]];
};

const isOldLoadout = (v: unknown): v is { readonly main: unknown; readonly sub: unknown } => typeof v === "object" && v !== null && "main" in v && "sub" in v;

export const weaponOf = (loadout: Loadout, slot: WeaponSlot): WeaponId => loadout[slot];

export const otherSlot = (slot: WeaponSlot): WeaponSlot => (slot === 0 ? 1 : 0);
