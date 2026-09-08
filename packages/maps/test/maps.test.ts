import { MAP_NAMES } from "@game/protocol";
import { MAP_HEIGHT, MAP_WIDTH, isRingOut, surfaceY, tiltOf } from "@game/sim";
import { describe, expect, it } from "vitest";
import { allMaps, getMap, heightsFromProfile, merge, resolveMapChoice, solidBelow } from "../src/index.js";

const checksum = (cells: Uint8Array): number => {
  let h = 0;
  for (let i = 0; i < cells.length; i++) h = (h * 31 + (cells[i] ?? 0) + i) % 1_000_000_007;
  return h;
};

describe("maps", () => {
  it("8 枚すべてが定義されている", () => {
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

  it("浮島は島の外と中央が奈落で、島の縁の下に浮き石がある", () => {
    const mask = getMap("island").build();
    const map = getMap("island");
    expect(isRingOut(mask, 5)).toBe(true);
    expect(isRingOut(mask, 200)).toBe(true);
    for (const x of map.spawns) expect(isRingOut(mask, x)).toBe(false);
    // 左の島の右端の下（x 120 付近、y 165 前後）に浮き石がある
    expect(mask.cells[170 * MAP_WIDTH + 120]).toBe(1);
    expect(mask.cells[155 * MAP_WIDTH + 120]).toBe(0);
  });

  it("平原は端から端まで地表の高低差が 5 セル以内", () => {
    const mask = getMap("plain").build();
    const ys = Array.from({ length: MAP_WIDTH }, (_, x) => surfaceY(mask, x));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(5);
  });

  it("段丘は左が高く右が低く、間に踊り場がある", () => {
    const mask = getMap("terrace").build();
    const map = getMap("terrace");
    expect(surfaceY(mask, map.spawns[0])).toBeLessThan(surfaceY(mask, map.spawns[1]) - 20);
    const landing = surfaceY(mask, 155);
    expect(landing).toBeGreaterThan(surfaceY(mask, map.spawns[0]));
    expect(landing).toBeLessThan(surfaceY(mask, map.spawns[1]));
  });

  it("橋は 1 枚の板で、その下は奈落", () => {
    const mask = getMap("bridge").build();
    expect(isRingOut(mask, 200)).toBe(false);
    expect(surfaceY(mask, 200)).toBe(surfaceY(mask, 90));
    // 橋の直下は空
    expect(mask.cells[130 * MAP_WIDTH + 200]).toBe(0);
    expect(mask.cells[200 * MAP_WIDTH + 200]).toBe(0);
  });

  it("洞窟は中央の上空に天井があり、スポーンの上空は開いている", () => {
    const mask = getMap("cave").build();
    expect(mask.cells[65 * MAP_WIDTH + 200]).toBe(1);
    expect(mask.cells[100 * MAP_WIDTH + 200]).toBe(0);
    for (const x of getMap("cave").spawns) for (let y = 0; y < surfaceY(mask, x); y++) expect(mask.cells[y * MAP_WIDTH + x]).toBe(0);
  });

  it("双塔はスポーンが塔の頂上で、塔は底まで詰まり、間は深い盆地、外側は奈落", () => {
    const mask = getMap("towers").build();
    for (const x of getMap("towers").spawns) {
      const top = surfaceY(mask, x);
      for (let y = top; y < MAP_HEIGHT; y++) expect(mask.cells[y * MAP_WIDTH + x]).toBe(1);
      expect(top).toBeLessThan(surfaceY(mask, 200) - 100);
    }
    expect(isRingOut(mask, 10)).toBe(true);
    expect(isRingOut(mask, 200)).toBe(false);
  });
});

describe("resolveMapChoice", () => {
  it("マップ名ならそのまま返す", () => {
    for (const name of MAP_NAMES) expect(resolveMapChoice(name, () => 0.99)).toBe(name);
  });

  it("ランダムは rng の値で 8 枚のどれかを等間隔に選び、1 に近い値でも範囲を出ない", () => {
    const picked = MAP_NAMES.map((_, i) => resolveMapChoice("random", () => i / MAP_NAMES.length));
    expect(picked).toEqual([...MAP_NAMES]);
    expect(MAP_NAMES).toContain(resolveMapChoice("random", () => 0.999999));
    expect(resolveMapChoice("random", () => 0)).toBe(MAP_NAMES[0]);
  });
});

describe("merge", () => {
  it("どれかのマスクが地面ならそのセルは地面", () => {
    const a = solidBelow(heightsFromProfile([[0, 200], [399, 200]]));
    const b = solidBelow(heightsFromProfile([[0, 100], [399, 100]]));
    const m = merge([a, b]);
    expect(m.cells[150 * MAP_WIDTH + 10]).toBe(1);
    expect(m.cells[50 * MAP_WIDTH + 10]).toBe(0);
    expect(surfaceY(m, 10)).toBe(100);
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
