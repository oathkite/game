import { Container, Sprite, type Texture } from "pixi.js";
type Effect = { readonly id: string; readonly frame: number; readonly x: number; readonly y: number; readonly alpha: number };
/** Sprites are owned and destroyed by the parent tank container. */
export const createTankEffectLayer = (parent: Container, label: string, frame: (id: string, index: number) => Texture) => {
  const sprites: Sprite[] = [];
  return (effects: readonly Effect[]) => {
    sprites.forEach(sprite => { sprite.visible = false; });
    effects.forEach((effect, index) => {
      const sprite = sprites[index] ?? new Sprite();
      if (!sprites[index]) {
        sprites.push(sprite); parent.addChild(sprite);
        sprite.label = `${label}-${index}`; sprite.scale.set(1 / 12);
      }
      sprite.texture = frame(effect.id, effect.frame);
      sprite.position.set(effect.x, effect.y);
      sprite.alpha = effect.alpha; sprite.visible = true;
    });
  };
};
