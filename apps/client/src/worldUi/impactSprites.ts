import { Assets, Rectangle, Texture } from "pixi.js";
import type { WeaponId } from "@game/protocol";
const urls = import.meta.glob<string>(["../../../../assets/runtime/tanks-v1/effect-explosion.png", "../../../../assets/runtime/tanks-v1/effect-energy.png", "../../../../assets/runtime/tanks-v1/effect-drill.png"], { eager: true, query: "?url", import: "default" });
const effectOf: Record<WeaponId, string> = { cannon: "explosion", triple: "explosion", multiple: "explosion", floater: "energy", stinger: "explosion", laser: "energy", drill: "drill", digger: "explosion" };
export const loadImpactArt = async () => {
  const clips = new Map<string, Texture[]>();
  await Promise.all(Object.entries(urls).map(async ([path, url]) => {
    const sheet = await Assets.load<Texture>(url);
    sheet.source.scaleMode = "nearest";
    clips.set(path.split("effect-")[1]!.replace(".png", ""), Array.from({ length: 4 }, (_, index) => new Texture({ source: sheet.source, frame: new Rectangle(index * 192, 0, 192, 160) })));
  }));
  return {
    textures: Object.fromEntries(Object.entries(effectOf).map(([weapon, id]) => [weapon, clips.get(id)!])) as Record<WeaponId, Texture[]>,
    destroy: () => { for (const frames of clips.values()) frames.forEach(texture => texture.destroy()); },
  };
};
