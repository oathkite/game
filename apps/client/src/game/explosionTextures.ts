import type { WeaponId } from "@game/protocol";
import { Texture } from "pixi.js";
import { explosionPixels, type BlastStage } from "./explosionSprite";
import type { Ramp } from "./palette";
import { toRgba, type PixelGrid } from "./pixelGrid";

// 爆発の絵の texture の使い回し。設計書 40.9 と 40.11。（武器、半径、段階、色）ごとに一度だけ canvas に焼く。
// マルチ弾の 9 発が同時に爆ぜても、毎フレームは Sprite の texture と位置を替えるだけにする。描画を閉じるときに destroy する。

export type ExplosionFrame = { readonly texture: Texture; readonly left: number; readonly top: number };

export type ExplosionTextures = {
  readonly get: (weapon: WeaponId, radius: number, stage: BlastStage, ramp: Ramp) => ExplosionFrame;
  readonly destroy: () => void;
};

const textureOf = (grid: PixelGrid): Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = grid.width;
  canvas.height = grid.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context がない");
  const image = ctx.createImageData(grid.width, grid.height);
  toRgba(grid, image.data);
  ctx.putImageData(image, 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
};

export const createExplosionTextures = (): ExplosionTextures => {
  const frames = new Map<string, ExplosionFrame>();
  return {
    get: (weapon, radius, stage, ramp) => {
      const key = `${weapon}|${radius}|${stage}|${stage === "ring" ? ramp.base : 0}`;
      const found = frames.get(key);
      if (found) return found;
      const grid = explosionPixels(weapon, radius, stage, ramp);
      const frame = { texture: textureOf(grid), left: grid.left, top: grid.top };
      frames.set(key, frame);
      return frame;
    },
    destroy: () => {
      for (const frame of frames.values()) frame.texture.destroy(true);
      frames.clear();
    },
  };
};
