import { MAP_NAMES } from "@game/protocol";
import { describe, expect, it } from "vitest";
import { mapThumbnail, THUMB_HEIGHT, THUMB_WIDTH } from "../src/screens/mapThumbnail";

// 設計書 09 の 9.4 のサムネイル。薄い地形が消えないこと、上が空で下が地面という向きが保たれることを固定する。

const at = (cells: Uint8Array, x: number, y: number): number => cells[y * THUMB_WIDTH + x] ?? -1;

describe("mapThumbnail", () => {
  it("80 × 45 で、どのマップも同じ配列を返す（キャッシュ）", () => {
    for (const name of MAP_NAMES) {
      const t = mapThumbnail(name);
      expect(t.length).toBe(THUMB_WIDTH * THUMB_HEIGHT);
      expect(mapThumbnail(name)).toBe(t);
    }
  });

  it("谷は上端が空で下端が地面", () => {
    const t = mapThumbnail("valley");
    expect(at(t, 40, 0)).toBe(0);
    expect(at(t, 40, THUMB_HEIGHT - 1)).toBe(1);
  });

  it("橋の厚さ 8 セルは 5 セル刻みでも 1 点以上残り、橋の下は空", () => {
    const t = mapThumbnail("bridge");
    const column = Array.from({ length: THUMB_HEIGHT }, (_, y) => at(t, 40, y));
    expect(column.filter((v) => v === 1).length).toBeGreaterThanOrEqual(1);
    expect(column.filter((v) => v === 1).length).toBeLessThanOrEqual(3);
    expect(at(t, 40, THUMB_HEIGHT - 1)).toBe(0);
  });

  it("洞窟は上端が天井、中ほどが空洞、下端が床", () => {
    const t = mapThumbnail("cave");
    expect(at(t, 40, 0)).toBe(1);
    expect(at(t, 40, 30)).toBe(0);
    expect(at(t, 40, THUMB_HEIGHT - 1)).toBe(1);
  });
});
