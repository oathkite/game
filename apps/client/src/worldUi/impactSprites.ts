import { Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";
import explosionUrl from "../../../../assets/runtime/tanks-v1/effect-explosion.png";
type Impact = { readonly cx: number; readonly cy: number; readonly frame: number };
export const loadImpactSprites = async () => {
  const sheet = await Assets.load<Texture>(explosionUrl);
  sheet.source.scaleMode = "nearest";
  const frames = Array.from({ length: 4 }, (_, index) => new Texture({ source: sheet.source, frame: new Rectangle(index * 192, 0, 192, 160) }));
  let parent: Container | null = null, sprites: Sprite[] = [];
  return {
    draw: (container: Container, impacts: readonly Impact[], reducedMotion: boolean) => {
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
    destroy: () => { frames.forEach(texture => texture.destroy()); },
  };
};
