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
  // The top moss rim also depends on the immediately preceding chunk row.
  for (let x = 0; x < region.width; x++) {
    const cell = region.y > 0 ? mask.cells[(region.y - 1) * mask.width + region.x + x]! : 0;
    if (above[x] !== cell) dirty = true;
    above[x] = cell;
  }
  return dirty;
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
  const above = new Uint8Array(region.width);
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
      ctx.fillStyle = "#74844c";
      for (let y = 0; y < region.height; y++) for (let x = 0; x < region.width; x++) {
        const index = (region.y + y) * mask.width + region.x + x;
        if (mask.cells[index] && (region.y + y === 0 || !mask.cells[index - mask.width])) ctx.fillRect(x * scale, y * scale, scale, 2);
      }
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
    tile.width = tile.height = 1024;
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
