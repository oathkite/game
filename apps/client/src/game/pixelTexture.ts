import { Sprite, Texture } from "pixi.js";
import { ART_PER_CELL, toRgba, type PixelGrid, type Rect } from "./pixelGrid";

// 画素の格子を canvas に写し、nearest で拡大する texture にする。設計書 40.3 と 40.11。
// 枠の大きさは固定し、描き直すたびに同じ canvas と texture を使い回す。座標はセルで、1 art px を 1/4 セルに縮めて置く。

export type PixelSprite = {
  readonly sprite: Sprite;
  /** 枠と同じ大きさの格子を描く */
  readonly draw: (grid: PixelGrid) => void;
  readonly destroy: () => void;
};

export const createPixelSprite = (frame: Rect): PixelSprite => {
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context がない");
  const image = ctx.createImageData(frame.width, frame.height);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  const sprite = new Sprite(texture);
  sprite.scale.set(1 / ART_PER_CELL);
  sprite.position.set(frame.left / ART_PER_CELL, frame.top / ART_PER_CELL);
  return {
    sprite,
    draw: (grid) => {
      toRgba(grid, image.data);
      ctx.putImageData(image, 0, 0);
      texture.source.update();
    },
    // 親の Container が先に子ごと破棄していても、texture と canvas はここで放す
    destroy: () => {
      if (!sprite.destroyed) sprite.destroy();
      texture.destroy(true);
    },
  };
};
