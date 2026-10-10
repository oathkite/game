import { describe, expect, it } from "vitest";
import { WEAPON_IDS } from "@game/protocol";
import { FIRE_RAMP, isPaletteColor, PALETTE, TEAM_RAMPS } from "@/game/palette";
import { getPixel, TRANSPARENT, type PixelGrid } from "@/game/pixelGrid";
import { explosionPixels, blastStage } from "@/game/explosionSprite";

// 爆発の絵。設計書 40.9。着弾したセルの中心を原点とする art px で描き、実際の半径の内側に収める

const opaque = (grid: PixelGrid) => {
  const out: { x: number; y: number; color: number }[] = [];
  for (let y = grid.top; y < grid.top + grid.height; y++) for (let x = grid.left; x < grid.left + grid.width; x++) {
    const color = getPixel(grid, x, y);
    if (color !== TRANSPARENT) out.push({ x, y, color });
  }
  return out;
};

describe("blastStage", () => {
  it("点灯は熱い火球、消灯は冷えた火球、輪は輪", () => {
    expect(blastStage(true, false)).toBe("hot");
    expect(blastStage(false, false)).toBe("cool");
    expect(blastStage(true, true)).toBe("ring");
  });
});

describe("explosionPixels", () => {
  it("火球は半径 r セルの円（中心から r × 4 + 2 art px）の内側に収まる", () => {
    for (const r of [2, 5, 10]) for (const stage of ["hot", "cool", "ring"] as const) {
      const limit = r * 4 + 2;
      for (const p of opaque(explosionPixels("cannon", r, stage, TEAM_RAMPS.red))) {
        expect(Math.hypot(p.x + 0.5, p.y + 0.5), `r ${r} ${stage}`).toBeLessThanOrEqual(limit + 0.01);
      }
    }
  });
  it("熱い火球は中心が白、縁ほど暗い炎の色", () => {
    const grid = explosionPixels("cannon", 10, "hot", TEAM_RAMPS.red);
    expect(getPixel(grid, 0, 0)).toBe(PALETTE.white);
    // 縁の起伏で半径は 84〜100% に揺れるので、確実に内側に入る外寄りの点で見る
    const edge = getPixel(grid, 0, 32);
    expect(FIRE_RAMP.indexOf(edge)).toBeGreaterThan(FIRE_RAMP.indexOf(PALETTE.fire1));
  });
  it("冷えた火球は白を含まない", () => {
    const colors = new Set(opaque(explosionPixels("cannon", 8, "cool", TEAM_RAMPS.red)).map(p => p.color));
    expect(colors.has(PALETTE.white)).toBe(false);
    expect(colors.size).toBeGreaterThan(2);
  });
  it("輪は撃った側の主色で、1 セル幅の帯だけを描く", () => {
    const pixels = opaque(explosionPixels("cannon", 6, "ring", TEAM_RAMPS.blue));
    const ramp = new Set([TEAM_RAMPS.blue.light, TEAM_RAMPS.blue.base, TEAM_RAMPS.blue.shadow]);
    for (const p of pixels) {
      expect(ramp.has(p.color)).toBe(true);
      expect(Math.hypot(p.x + 0.5, p.y + 0.5)).toBeGreaterThan(6 * 4 + 2 - 4 - 0.01);
    }
  });
  it("武器ごとの形（38 章 E4）。レーザー弾は横に長い十字、掘削弾は下へ長い", () => {
    const extent = (weapon: (typeof WEAPON_IDS)[number]) => {
      const ps = opaque(explosionPixels(weapon, 6, "hot", TEAM_RAMPS.red));
      return { w: Math.max(...ps.map(p => p.x)) - Math.min(...ps.map(p => p.x)), up: -Math.min(...ps.map(p => p.y)), down: Math.max(...ps.map(p => p.y)), count: ps.length };
    };
    const laser = extent("laser"), digger = extent("digger"), cannon = extent("cannon");
    expect(laser.w).toBeGreaterThan(laser.up * 1.5);
    expect(laser.count).toBeLessThan(cannon.count / 2);
    expect(digger.down).toBeGreaterThan(digger.up);
  });
  it("描いた画素はすべて固定パレットの色", () => {
    for (const weapon of WEAPON_IDS) for (const stage of ["hot", "cool", "ring"] as const) {
      for (const p of opaque(explosionPixels(weapon, 7, stage, TEAM_RAMPS.purple))) expect(isPaletteColor(p.color), `${weapon} ${stage}`).toBe(true);
    }
  });
});
