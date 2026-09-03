import { MAP_NAMES } from "@game/protocol";
import { MAP_HEIGHT, MAP_WIDTH, isRingOut, surfaceY, tiltOf } from "@game/sim";
import { describe, expect, it } from "vitest";
import { allMaps, getMap, heightsFromProfile } from "../src/index.js";

const checksum = (cells: Uint8Array): number => {
  let h = 0;
  for (let i = 0; i < cells.length; i++) h = (h * 31 + (cells[i] ?? 0) + i) % 1_000_000_007;
  return h;
};

describe("maps", () => {
  it("3 枚すべてが定義されている", () => {
    expect(allMaps().map((m) => m.name)).toEqual([...MAP_NAMES]);
  });

  for (const name of MAP_NAMES) {
    describe(name, () => {
      const map = getMap(name);
      const mask = map.build();

      it("大きさは 400 × 225", () => {
        expect(mask.width).toBe(MAP_WIDTH);
        expect(mask.height).toBe(MAP_HEIGHT);
      });

      it("スポーンは地面の上で、傾きが小さい", () => {
        for (const x of map.spawns) {
          expect(isRingOut(mask, x)).toBe(false);
          expect(surfaceY(mask, x)).toBeLessThan(MAP_HEIGHT - 10);
          expect(Math.abs(tiltOf(mask, x))).toBeLessThanOrEqual(10);
        }
      });

      it("席 0 は左、席 1 は右にいる", () => {
        expect(map.spawns[0]).toBeLessThan(MAP_WIDTH / 2);
        expect(map.spawns[1]).toBeGreaterThan(MAP_WIDTH / 2);
      });

      it("同じ結果を返す（決定論）", () => {
        expect(checksum(map.build().cells)).toBe(checksum(mask.cells));
        expect(checksum(mask.cells)).toMatchSnapshot();
      });
    });
  }

  it("谷は中央が両端より低い", () => {
    const mask = getMap("valley").build();
    expect(surfaceY(mask, 200)).toBeGreaterThan(surfaceY(mask, 55) + 40);
  });

  it("山越えは中央が両端より高い", () => {
    const mask = getMap("mountain").build();
    expect(surfaceY(mask, 200)).toBeLessThan(surfaceY(mask, 60) - 80);
  });

  it("浮島は島の外が奈落", () => {
    const mask = getMap("island").build();
    expect(isRingOut(mask, 5)).toBe(true);
    expect(isRingOut(mask, 150)).toBe(true);
    expect(isRingOut(mask, 200)).toBe(false);
  });
});

describe("heightsFromProfile", () => {
  it("頂点の間を整数で補間する", () => {
    const h = heightsFromProfile([[0, 100], [10, 110], [399, 110]]);
    expect(h[0]).toBe(100);
    expect(h[5]).toBe(105);
    expect(h[10]).toBe(110);
    expect(h[399]).toBe(110);
    expect(h.every((v) => Number.isInteger(v))).toBe(true);
  });
});
