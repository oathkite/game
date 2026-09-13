import { Assets, type Texture } from "pixi.js";
import type { WeaponId } from "@game/protocol";
const urls = import.meta.glob<string>("../../../../assets/runtime/tanks-v1/projectile-*.png", { eager: true, query: "?url", import: "default" });
export const loadProjectileArt = async (): Promise<Readonly<Record<WeaponId, Texture>>> => Object.fromEntries(await Promise.all(Object.entries(urls).map(async ([path, url]) => {
  const texture = await Assets.load<Texture>(url);
  texture.source.scaleMode = "nearest";
  return [path.split("projectile-")[1]!.replace(".png", ""), texture];
}))) as Record<WeaponId, Texture>;
