import type { TerrainMask } from "@game/sim";
import { Container, Sprite, Texture } from "pixi.js";
import { createGrid, toRgba, type Rect } from "./pixelGrid";
import type { TerrainLayer } from "./terrainLayer";
import { changedRect, paintTerrain, terrainDepth, TEXELS, type TerrainContext, type TerrainTheme } from "./terrainPaint";

// ドットの地形の層。設計書 40.6。1 セルを 4 × 4 texel で塗り、128 セル四方の塊ごとに canvas と texture を持つ。
// 地形が削れたら、変わったセルの矩形に 1 セルの余白を足した範囲だけを塗り直す（隣のセルの縁と草が変わるため）。

const CHUNK_CELLS = 128;

const createChunk = (region: Rect) => {
  const canvas = document.createElement("canvas");
  canvas.width = region.width * TEXELS;
  canvas.height = region.height * TEXELS;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context がない");
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  const sprite = new Sprite(texture);
  sprite.position.set(region.left, region.top);
  sprite.width = region.width;
  sprite.height = region.height;
  /** rect（セル）のうち、この塊に入る部分を塗る */
  const paint = (context: TerrainContext, rect: Rect): void => {
    const left = Math.max(rect.left, region.left), top = Math.max(rect.top, region.top);
    const right = Math.min(rect.left + rect.width, region.left + region.width), bottom = Math.min(rect.top + rect.height, region.top + region.height);
    if (right <= left || bottom <= top) return;
    const grid = createGrid(left * TEXELS, top * TEXELS, (right - left) * TEXELS, (bottom - top) * TEXELS);
    paintTerrain(context, grid);
    const image = ctx.createImageData(grid.width, grid.height);
    toRgba(grid, image.data);
    ctx.putImageData(image, (left - region.left) * TEXELS, (top - region.top) * TEXELS);
    texture.source.update();
  };
  return { sprite, paint, destroy: () => { sprite.destroy(); texture.destroy(true); } };
};

/** original は最初の地形。草が生えるのは original の地表で、削れて出てきた面は焦げた縁にする */
export const createPixelTerrainLayer = (original: TerrainMask, theme: TerrainTheme): TerrainLayer => {
  const sprite = new Container();
  const depth = terrainDepth(original);
  const context = (mask: TerrainMask): TerrainContext => ({ mask, original, depth, theme });
  const chunks: ReturnType<typeof createChunk>[] = [];
  for (let y = 0; y < original.height; y += CHUNK_CELLS) for (let x = 0; x < original.width; x += CHUNK_CELLS) {
    const region = { left: x, top: y, width: Math.min(CHUNK_CELLS, original.width - x), height: Math.min(CHUNK_CELLS, original.height - y) };
    const chunk = createChunk(region);
    chunk.paint(context(original), region);
    sprite.addChild(chunk.sprite);
    chunks.push(chunk);
  }
  let current = original;
  return {
    sprite,
    update: (next) => {
      const rect = changedRect(current, next, 1);
      current = next;
      if (rect) for (const chunk of chunks) chunk.paint(context(next), rect);
    },
    destroy: () => { for (const chunk of chunks) chunk.destroy(); sprite.destroy(); },
  };
};
