import type { TerrainMask } from "@game/sim";
import { Sprite, Texture } from "pixi.js";

// 地形マスクを 1 セル 1 ピクセルのテクスチャにして、最近傍補間で整数倍に拡大する（設計書 07 の 7.1）。

export type TerrainLayer = {
  readonly sprite: Sprite;
  readonly update: (mask: TerrainMask) => void;
  readonly destroy: () => void;
};

export const createTerrainLayer = (mask: TerrainMask): TerrainLayer => {
  const canvas = document.createElement("canvas");
  canvas.width = mask.width;
  canvas.height = mask.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context がない");
  const image = ctx.createImageData(mask.width, mask.height);

  const paint = (m: TerrainMask): void => {
    const data = image.data;
    for (let i = 0; i < m.cells.length; i++) {
      const solid = m.cells[i] === 1;
      const o = i * 4;
      data[o] = 255;
      data[o + 1] = 255;
      data[o + 2] = 255;
      data[o + 3] = solid ? 255 : 0;
    }
    ctx.putImageData(image, 0, 0);
  };

  paint(mask);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  const sprite = new Sprite(texture);
  sprite.width = mask.width;
  sprite.height = mask.height;

  return {
    sprite,
    update: (m) => {
      paint(m);
      texture.source.update();
    },
    destroy: () => {
      sprite.destroy();
      texture.destroy(true);
    },
  };
};
