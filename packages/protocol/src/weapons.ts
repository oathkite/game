// 武器。設計書 10。メインとサブの候補と、画面に出す名前と説明。
// 物理の数値（爆風半径、ダメージ、初速の倍率）は sim の weapons.ts に置く。ここには語彙だけを置く。

export const MAIN_WEAPON_IDS = ["cannon", "heavy", "sniper"] as const;
export const SUB_WEAPON_IDS = ["digger", "floater", "stinger"] as const;

export type MainWeaponId = (typeof MAIN_WEAPON_IDS)[number];
export type SubWeaponId = (typeof SUB_WEAPON_IDS)[number];
export type WeaponId = MainWeaponId | SubWeaponId;

/** そのターンにメインとサブのどちらで撃つか */
export type WeaponSlot = "main" | "sub";
export const WEAPON_SLOTS = ["main", "sub"] as const;

/** プレイヤーが選ぶメインとサブの組み合わせ。組み合わせは自由 */
export type Loadout = {
  readonly main: MainWeaponId;
  readonly sub: SubWeaponId;
};

export const DEFAULT_LOADOUT: Loadout = { main: "cannon", sub: "digger" };

export const WEAPON_LABELS: Readonly<Record<WeaponId, string>> = {
  cannon: "標準砲",
  heavy: "重砲",
  sniper: "長砲",
  digger: "掘削弾",
  floater: "浮遊弾",
  stinger: "針弾",
};

/** 設定画面に出す一行の説明。数値は出さず、性格だけを伝える */
export const WEAPON_DESCRIPTIONS: Readonly<Record<WeaponId, string>> = {
  cannon: "癖のない基準の砲",
  heavy: "遅く重い弾。爆風が広く、当たれば痛い",
  sniper: "速く伸びる弾。風に流されにくく、爆風は狭い",
  digger: "地形を大きく削る。機体にはほとんど効かない",
  floater: "ゆっくり飛び、風に強く流される",
  stinger: "爆風は針の穴ほど。直撃なら最大の一撃",
};

export const weaponOf = (loadout: Loadout, slot: WeaponSlot): WeaponId => (slot === "main" ? loadout.main : loadout.sub);
