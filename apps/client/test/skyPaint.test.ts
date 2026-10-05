import { describe, expect, it } from "vitest";
import { getPixel, TRANSPARENT } from "@/game/pixelGrid";
import { MOUNTAIN_PERIOD, paintMountains, paintSky, SKY_THEMES, skyStars, twinkleOn, type SkyTheme } from "@/game/skyPaint";
import { offPalette } from "./offPalette";

// 背景の夜空と山並み。設計書 40.7。画面の art px（2 CSS px）で描く

const THEMES = Object.keys(SKY_THEMES) as SkyTheme[];

describe("paintSky", () => {
  it("上の行は最初の帯の色、下の行は最後の帯の色で塗り、すべて固定パレットの色", () => {
    for (const theme of THEMES) {
      const sky = paintSky(theme, 160, 90);
      const bands = SKY_THEMES[theme].bands;
      expect(getPixel(sky, 3, 0)).toBe(bands[0]);
      expect(getPixel(sky, 3, 89)).toBe(bands[bands.length - 1]);
      expect(offPalette(sky.pixels), theme).toEqual([]);
    }
  });
  it("帯の境目は 2 色の市松でつなぐ（グラデーションを使わない）", () => {
    const sky = paintSky("ridge", 64, 100);
    const moon = new Set<number>([SKY_THEMES.ridge.moon.light, SKY_THEMES.ridge.moon.shade]);
    const rows = Array.from({ length: 100 }, (_, y) => new Set(Array.from({ length: 64 }, (_, x) => getPixel(sky, x, y)).filter(c => !moon.has(c))));
    expect(rows.some(colors => colors.size === 2)).toBe(true);
    expect(rows.every(colors => colors.size <= 2)).toBe(true);
  });
  it("月を描く。ステージごとに位置が違う", () => {
    const moonAt = (theme: SkyTheme) => {
      const sky = paintSky(theme, 200, 100);
      for (let y = 0; y < 100; y++) for (let x = 0; x < 200; x++) if (getPixel(sky, x, y) === SKY_THEMES[theme].moon.light) return `${x},${y}`;
      return null;
    };
    const spots = THEMES.map(moonAt);
    expect(spots.every(s => s !== null)).toBe(true);
    expect(new Set(spots).size).toBe(THEMES.length);
  });
  it("同じ大きさなら同じ絵になる（乱数を使わない）", () => {
    expect(Array.from(paintSky("islands", 80, 60).pixels).join()).toBe(Array.from(paintSky("islands", 80, 60).pixels).join());
  });
});

describe("skyStars と twinkleOn", () => {
  it("星は画面の上寄りに置き、浮島がいちばん多い", () => {
    const count = (theme: SkyTheme) => skyStars(theme, 320, 180).length;
    for (const theme of THEMES) {
      const stars = skyStars(theme, 320, 180);
      expect(stars.length).toBeGreaterThan(10);
      for (const s of stars) { expect(s.x).toBeGreaterThanOrEqual(0); expect(s.x).toBeLessThan(320); expect(s.y).toBeLessThan(180 * 0.75); }
    }
    expect(count("islands")).toBeGreaterThan(count("ridge"));
  });
  it("瞬く星は周期で明暗を替え、動きを減らす設定では替えない", () => {
    const states = Array.from({ length: 30 }, (_, i) => twinkleOn(3, i * 100, false));
    expect(new Set(states).size).toBe(2);
    expect(Array.from({ length: 30 }, (_, i) => twinkleOn(3, i * 100, true)).every(s => s)).toBe(true);
  });
});

describe("paintMountains", () => {
  it("横に繰り返しても継ぎ目が出ない（周期の左端と右端がつながる）", () => {
    for (const theme of THEMES) for (const layer of [0, 1] as const) {
      const m = paintMountains(theme, layer, 60);
      expect(m.width).toBe(MOUNTAIN_PERIOD);
      const column = (x: number) => Array.from({ length: 60 }, (_, y) => getPixel(m, x, y) === TRANSPARENT ? 0 : 1).join("");
      expect(column(0).length).toBe(60);
      // 右端の列と左端の列（繰り返したときの隣）の高さの差は、絵の中の隣り合う列の差を超えない
      const top = (x: number) => column(x).indexOf("1");
      const steps = Array.from({ length: MOUNTAIN_PERIOD - 1 }, (_, x) => Math.abs(top(x) - top(x + 1)));
      expect(Math.abs(top(0) - top(MOUNTAIN_PERIOD - 1))).toBeLessThanOrEqual(Math.max(...steps));
      expect(offPalette(m.pixels.filter(color => color !== TRANSPARENT)), `${theme} ${layer}`).toEqual([]);
    }
  });
  it("遠景と中景で色が違い、上の縁に月明かりの線を持つ", () => {
    const far = paintMountains("ridge", 0, 60), near = paintMountains("ridge", 1, 60);
    const colors = (m: typeof far) => new Set(Array.from(m.pixels).filter(c => c !== TRANSPARENT));
    expect([...colors(far)].some(c => colors(near).has(c) && c === SKY_THEMES.ridge.far.fill)).toBe(false);
    expect(colors(far).has(SKY_THEMES.ridge.far.rim)).toBe(true);
  });
});
