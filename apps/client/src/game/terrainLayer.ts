import type { TerrainMask } from "@game/sim";
import { Sprite, Texture } from "pixi.js";

export type TerrainLayer = {
  readonly sprite: Sprite;
  readonly update: (mask: TerrainMask) => void;
  readonly destroy: () => void;
};

export const createTerrainLayer = (mask: TerrainMask, art?: CanvasImageSource): TerrainLayer => {
  // Physics stays at one cell per pixel. Artwork gets four texels per cell so
  // its detail is not lost when the camera magnifies the terrain.
  const scale = art ? 4 : 1;
  const canvas = document.createElement("canvas"), maskCanvas = document.createElement("canvas");
  canvas.width = mask.width * scale; canvas.height = mask.height * scale;
  maskCanvas.width = mask.width; maskCanvas.height = mask.height;
  const ctx = canvas.getContext("2d"), maskContext = maskCanvas.getContext("2d");
  if (!ctx || !maskContext) throw new Error("2d context がない");
  ctx.imageSmoothingEnabled = false;
  const tile = document.createElement("canvas"); tile.width = tile.height = 256;
  const tileContext = tile.getContext("2d");
  if (art && tileContext) { tileContext.imageSmoothingEnabled = false; tileContext.drawImage(art, 0, 0, 256, 256); }
  const pattern = art ? ctx.createPattern(tile, "repeat") : null;
  const image = maskContext.createImageData(mask.width, mask.height);
  const paint = (m: TerrainMask): void => {
    for (let i = 0; i < m.cells.length; i++) {
      const o = i * 4;
      image.data[o] = image.data[o + 1] = image.data[o + 2] = 255;
      image.data[o + 3] = m.cells[i] === 1 ? 255 : 0;
    }
    maskContext.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
    if (pattern) {
      ctx.globalCompositeOperation = "source-in"; ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalCompositeOperation = "source-over";
      // A narrow moss rim stays inside solid cells, including newly formed craters.
      ctx.fillStyle = "#74844c";
      for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
        if (m.cells[y * m.width + x] && (y === 0 || !m.cells[(y - 1) * m.width + x])) ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  };
  paint(mask);
  const texture = Texture.from(canvas); texture.source.scaleMode = "nearest";
  const sprite = new Sprite(texture); sprite.width = mask.width; sprite.height = mask.height;
  return {
    sprite,
    update: m => { paint(m); texture.source.update(); },
    destroy: () => { sprite.destroy(); texture.destroy(true); },
  };
};
