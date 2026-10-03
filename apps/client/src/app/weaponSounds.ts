import type { WeaponId } from "@game/protocol";
export type WeaponSound = `${Exclude<WeaponId, "cannon">}-${"fire" | "impact"}`;
export const weaponSound = (weapon: WeaponId, event: "fire" | "impact"): WeaponSound | "fire" | "explosion" =>
  weapon === "cannon" ? event === "fire" ? "fire" : "explosion" : `${weapon}-${event}`;
