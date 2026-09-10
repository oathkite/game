import { Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";
import type { WeaponId } from "@game/protocol";
const urls = import.meta.glob<string>("../../../../assets/runtime/tanks-v1/effect-*.png", { eager: true, query: "?url", import: "default" });
const effectOf: Record<WeaponId, string> = { cannon: "explosion", triple: "explosion", multiple: "explosion", floater: "explosion", stinger: "explosion", laser: "energy", drill: "drill", digger: "dig" };
type Impact = { readonly cx: number; readonly cy: number; readonly frame: number };
export const loadImpactSprites = async () => {
  const clips = new Map<string, Texture[]>();
  await Promise.all(Object.entries(urls).map(async ([path, url]) => {
    const sheet = await Assets.load<Texture>(url);
    sheet.source.scaleMode = "nearest";
    clips.set(path.split("effect-")[1]!.replace(".png", ""), Array.from({ length: 4 }, (_, index) => new Texture({ source: sheet.source, frame: new Rectangle(index * 192, 0, 192, 160) })));
  }));
  let parent: Container | null = null, sprites: Sprite[] = [];
  return {
    draw: (container: Container, impacts: readonly Impact[], reducedMotion: boolean, weapon: WeaponId) => {
      const frames = clips.get(effectOf[weapon])!;
      if (parent !== container) { parent = container; sprites = []; }
      while (sprites.length < impacts.length) {
        const sprite = new Sprite(frames[0]!);
        sprite.scale.set(1 / 12);
        container.addChild(sprite); sprites.push(sprite);
      }
      sprites.forEach((sprite, index) => {
        const impact = impacts[index]; sprite.visible = !!impact;
        if (impact) { sprite.texture = frames[reducedMotion ? 1 : impact.frame]!; sprite.position.set(impact.cx - 8, impact.cy - 8); }
      });
    },
    destroy: () => { for (const frames of clips.values()) frames.forEach(texture => texture.destroy()); },
  };
};
