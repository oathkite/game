import type { TerrainOp } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { Container, Sprite, Texture } from "pixi.js";
import type { TerrainLayer } from "./terrainLayer";

type Region = { x: number; y: number; width: number; height: number };
const SCALE = 12, CHUNK = 128;
const createChunk = (region: Region, original: TerrainMask, art: CanvasImageSource) => {
  const canvas = document.createElement("canvas");
  canvas.width = region.width * SCALE; canvas.height = region.height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const context = ctx;
  context.scale(SCALE, SCALE); context.translate(-region.x, -region.y);
  context.imageSmoothingEnabled = false;
  const texture = Texture.from(canvas); texture.source.scaleMode = "nearest";
  const sprite = new Sprite(texture);
  sprite.position.set(region.x, region.y); sprite.width = region.width; sprite.height = region.height;
  let previous = original;
  const restore = () => {
    context.globalCompositeOperation = "source-over";
    context.clearRect(region.x, region.y, region.width, region.height);
    context.drawImage(art, 0, 0, original.width, original.height);
  };
  restore();
  const paint = (next: TerrainMask, cut?: TerrainOp) => {
    let changed = false, restored = false;
    for (let y = region.y; y < region.y + region.height; y++) for (let x = region.x; x < region.x + region.width; x++) {
      const i = y * next.width + x;
      if (next.cells[i] !== previous.cells[i]) { changed = true; restored ||= next.cells[i] === 1; }
    }
    const intersects = cut && cut.cx + cut.radius >= region.x && cut.cx - cut.radius < region.x + region.width
      && cut.cy + cut.radius >= region.y && cut.cy - cut.radius < region.y + region.height;
    if (!changed && !intersects) { previous = next; return; }
    if (restored) restore();
    if (cut && !restored) {
      // Keep the image silhouette intact; impact circles cut at artwork resolution.
      context.beginPath(); context.arc(cut.cx + 0.5, cut.cy + 0.5, cut.radius + 0.5, 0, Math.PI * 2);
      context.globalCompositeOperation = "source-atop";
      context.strokeStyle = "rgba(43,32,27,.8)"; context.lineWidth = 0.65; context.stroke();
      context.globalCompositeOperation = "destination-out"; context.fill();
    } else {
      // Snapshot/restore fallback, without quantizing untouched alpha edges.
      const before = restored ? original : previous;
      context.globalCompositeOperation = "destination-out";
      for (let y = region.y; y < region.y + region.height; y++) for (let x = region.x; x < region.x + region.width; x++) {
        const i = y * next.width + x;
        if (before.cells[i] && !next.cells[i]) context.fillRect(x, y, 1, 1);
      }
    }
    context.globalCompositeOperation = "source-over";
    previous = next; texture.source.update();
  };
  return { sprite, paint, destroy: () => { sprite.destroy(); texture.destroy(true); } };
};

/** Full map artwork, not a repeated tile. Physics remains a shared immutable mask. */
export const createImageTerrainLayer = (mask: TerrainMask, art: CanvasImageSource): TerrainLayer => {
  const sprite = new Container(), chunks: ReturnType<typeof createChunk>[] = [];
  for (let y = 0; y < mask.height; y += CHUNK) for (let x = 0; x < mask.width; x += CHUNK) {
    const chunk = createChunk({ x, y, width: Math.min(CHUNK, mask.width - x), height: Math.min(CHUNK, mask.height - y) }, mask, art);
    chunks.push(chunk); sprite.addChild(chunk.sprite);
  }
  return { sprite, update: (next, cut) => { for (const chunk of chunks) chunk.paint(next, cut); },
    destroy: () => { for (const chunk of chunks) chunk.destroy(); sprite.destroy(); } };
};
