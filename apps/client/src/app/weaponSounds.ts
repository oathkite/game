import type { WeaponId } from "@game/protocol";
export type WeaponSound = `${Exclude<WeaponId, "cannon">}-${"fire" | "impact"}`;
export const weaponSound = (weapon: WeaponId, event: "fire" | "impact"): WeaponSound | "fire" | "explosion" =>
  weapon === "cannon" ? event === "fire" ? "fire" : "explosion" : `${weapon}-${event}`;
/** Mechanical weapons use the adopted Suno recordings at distinct pitches. */
export const weaponSample = (name: string): { name: "fire" | "explosion"; rate: number } | null => {
  const [weapon, event] = name.split("-");
  const rates: Record<string, number> = { triple: 1.25, multiple: 1.65, drill: 0.7, digger: 0.85, stinger: 1.45 };
  return weapon && rates[weapon] && (event === "fire" || event === "impact")
    ? { name: event === "fire" ? "fire" : "explosion", rate: rates[weapon] } : null;
};
