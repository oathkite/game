import type { TerrainMask } from "@game/sim";
import { Container, Sprite, Texture } from "pixi.js";

export type TerrainLayer = {
  readonly sprite: Container;
  readonly update: (mask: TerrainMask) => void;
  readonly destroy: () => void;
};

type Region = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
const CHUNK_CELLS = 128;
const ART_PIXELS_PER_CELL = 12;

const updateMask = (mask: TerrainMask, region: Region, image: ImageData, above: Uint8Array): boolean => {
  let dirty = false;
  for (let y = 0; y < region.height; y++) for (let x = 0; x < region.width; x++) {
    const offset = (y * region.width + x) * 4;
    const alpha = mask.cells[(region.y + y) * mask.width + region.x + x] === 1 ? 255 : 0;
    if (image.data[offset + 3] !== alpha) dirty = true;
    image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = 255;
    image.data[offset + 3] = alpha;
  }
  // Hanging moss reaches two cells below its surface; include the air above it.
  for (let row = 1; row <= 3; row++) for (let x = 0; x < region.width; x++) {
    const cell = region.y >= row ? mask.cells[(region.y - row) * mask.width + region.x + x]! : 0;
    const index = (row - 1) * region.width + x;
    if (above[index] !== cell) dirty = true;
    above[index] = cell;
  }
  return dirty;
};

const paintMoss = (ctx: CanvasRenderingContext2D, mask: TerrainMask, region: Region, scale: number) => {
  for (let y = Math.max(0, region.y - 2); y < region.y + region.height; y++) for (let x = 0; x < region.width; x++) {
    const index = y * mask.width + region.x + x;
    if (!mask.cells[index] || (y > 0 && mask.cells[index - mask.width])) continue;
    const top = (y - region.y) * scale;
    for (let column = 0; column < 4; column++) {
      const hash = ((region.x + x) * 37 + y * 17 + column * 11) >>> 0;
      const left = x * scale + column * 3, depth = 16 + hash % 16;
      ctx.fillStyle = "#294b32"; ctx.fillRect(left, top, 3, depth);
      ctx.fillStyle = "#527b39"; ctx.fillRect(left, top, 3, depth - 5);
      ctx.fillStyle = hash % 3 === 0 ? "#adbd56" : "#89a747"; ctx.fillRect(left, top, 3, 5 + hash % 7);
      ctx.fillStyle = "#89a747"; ctx.fillRect(left, top + depth - 8, 2, 3);
    }
    ctx.fillStyle = "#74844c"; ctx.fillRect(x * scale, top, scale, 2);
  }
};

const createChunk = (region: Region, scale: number, tile?: HTMLCanvasElement) => {
  const canvas = document.createElement("canvas"), maskCanvas = document.createElement("canvas");
  canvas.width = region.width * scale; canvas.height = region.height * scale;
  maskCanvas.width = region.width; maskCanvas.height = region.height;
  const ctx = canvas.getContext("2d"), maskContext = maskCanvas.getContext("2d");
  if (!ctx || !maskContext) throw new Error("2d context がない");
  ctx.imageSmoothingEnabled = false;
  const pattern = tile ? ctx.createPattern(tile, "repeat") : null;
  pattern?.setTransform(new DOMMatrix().translate(-region.x * scale, -region.y * scale));
  const image = maskContext.createImageData(region.width, region.height);
  const texture = Texture.from(canvas); texture.source.scaleMode = "nearest";
  const sprite = new Sprite(texture);
  sprite.position.set(region.x, region.y); sprite.width = region.width; sprite.height = region.height;
  const above = new Uint8Array(region.width * 3);
  let painted = false;
  const paint = (mask: TerrainMask) => {
    const dirty = updateMask(mask, region, image, above);
    if (painted && !dirty) return;
    painted = true;
    maskContext.putImageData(image, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
    if (pattern) {
      ctx.globalCompositeOperation = "source-in"; ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalCompositeOperation = "source-over";
      paintMoss(ctx, mask, region, scale);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
    }
    texture.source.update();
  };
  return { sprite, paint, destroy: () => { sprite.destroy(); texture.destroy(true); } };
};

export const createTerrainLayer = (mask: TerrainMask, art?: CanvasImageSource): TerrainLayer => {
  // Match tank artwork density, with each GPU texture bounded to 1536px.
  const scale = art ? ART_PIXELS_PER_CELL : 1;
  const tile = art ? document.createElement("canvas") : undefined;
  if (tile && art) {
    // The generated clusters become roughly one tank-art pixel at this tile size.
    tile.width = tile.height = 256;
    const context = tile.getContext("2d");
    if (!context) throw new Error("2d context がない");
    context.imageSmoothingEnabled = false; context.drawImage(art, 0, 0, tile.width, tile.height);
  }
  const sprite = new Container();
  const chunks: ReturnType<typeof createChunk>[] = [];
  for (let y = 0; y < mask.height; y += CHUNK_CELLS) for (let x = 0; x < mask.width; x += CHUNK_CELLS) {
    const chunk = createChunk({ x, y, width: Math.min(CHUNK_CELLS, mask.width - x), height: Math.min(CHUNK_CELLS, mask.height - y) }, scale, tile);
    chunk.paint(mask); sprite.addChild(chunk.sprite); chunks.push(chunk);
  }
  return {
    sprite,
    update: next => { for (const chunk of chunks) chunk.paint(next); },
    destroy: () => { for (const chunk of chunks) chunk.destroy(); sprite.destroy(); },
  };
};
