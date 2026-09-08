import { getMap } from "@game/maps";
import { MAP_HEIGHT, MAP_WIDTH, type MapName } from "@game/protocol";

// マップ選択のサムネイル。設計書 09 の 9.4。
// 地形マスク（400 × 225）を 5 × 5 セルごとに 1 点へ落とし、80 × 45 の白黒の絵にする。
// 判定は「どれか 1 セルでも地面なら白」にする。橋（厚さ 8）や双塔の台（厚さ 10）のような薄い地形が消えないようにするためである。

export const THUMB_SCALE = 5;
export const THUMB_WIDTH = MAP_WIDTH / THUMB_SCALE;
export const THUMB_HEIGHT = MAP_HEIGHT / THUMB_SCALE;

const cache = new Map<MapName, Uint8Array>();

/** 長さ THUMB_WIDTH * THUMB_HEIGHT。添字は y * THUMB_WIDTH + x。1 なら地面 */
export const mapThumbnail = (name: MapName): Uint8Array => {
  const cached = cache.get(name);
  if (cached) return cached;
  const mask = getMap(name).build();
  const out = new Uint8Array(THUMB_WIDTH * THUMB_HEIGHT);
  for (let ty = 0; ty < THUMB_HEIGHT; ty++) {
    for (let tx = 0; tx < THUMB_WIDTH; tx++) {
      out[ty * THUMB_WIDTH + tx] = blockHasGround(mask.cells, tx * THUMB_SCALE, ty * THUMB_SCALE) ? 1 : 0;
    }
  }
  cache.set(name, out);
  return out;
};

const blockHasGround = (cells: Uint8Array, x0: number, y0: number): boolean => {
  for (let y = y0; y < y0 + THUMB_SCALE; y++) {
    const row = y * MAP_WIDTH;
    for (let x = x0; x < x0 + THUMB_SCALE; x++) if (cells[row + x] === 1) return true;
  }
  return false;
};
