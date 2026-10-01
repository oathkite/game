import type { WeaponId } from "./weapons.js";

// アイテム。設計書 42。1 試合にそれぞれ 1 回だけ使え、使った手番の射撃を変える。
// 物理（2 発目の発射、テレポートの着地）は sim の ballistics.ts と teleport.ts に置く。ここには語彙だけを置く。

export const ITEM_IDS = ["double", "teleport"] as const;

export type ItemId = (typeof ITEM_IDS)[number];

export const ITEM_LABELS: Readonly<Record<ItemId, string>> = {
  double: "ダブルシュート",
  teleport: "テレポート",
};

export const isItemId = (v: unknown): v is ItemId => typeof v === "string" && (ITEM_IDS as readonly string[]).includes(v);

/** テレポートの弾は、選んだ武器に関わらず標準砲で飛ぶ（42.3） */
export const TELEPORT_WEAPON: WeaponId = "cannon";

/** その手番に実際に撃つ武器。テレポートなら標準砲、それ以外は選んだ武器 */
export const shotWeapon = (weapon: WeaponId, item?: ItemId): WeaponId => (item === "teleport" ? TELEPORT_WEAPON : weapon);
