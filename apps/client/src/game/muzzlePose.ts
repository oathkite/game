import type { WeaponId } from "@game/protocol";
export type ShotFlash = { readonly age: number; readonly index: number };
export const shotFlashes = (now: number, launches: readonly number[]): readonly ShotFlash[] =>
  launches.flatMap((at, index) => now >= at && now - at < 140 ? [{ age: now - at, index }] : []);
/** baseline-v2 emission ports, pivot and effect origin, in twelve art pixels per cell. */
export const muzzlePose = (weapon: WeaponId, flash: ShotFlash, recoil: number) => {
  const ports = weapon === "triple" ? [89, 96, 103] : weapon === "multiple" ? [86, 96, 105] : [96];
  const energy = weapon === "laser" || weapon === "floater";
  return {
    id: energy ? "effect-energy" : "effect-muzzle",
    frame: energy ? 0 : flash.age < 25 ? 0 : flash.age < 60 ? 1 : flash.age < 100 ? 2 : 3,
    alpha: energy ? 1 - flash.age / 140 : 1,
    x: (144 - 96 - 96 - recoil) / 12,
    y: (ports[flash.index % ports.length]! - 96 - 96) / 12,
  };
};
