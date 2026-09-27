import { describe, expect, it } from "vitest";
import { WEAPON_IDS } from "@game/protocol";
import { isPaletteColor, PALETTE, TEAM_RAMPS } from "@/game/palette";
import { opaqueBounds, TRANSPARENT } from "@/game/pixelGrid";
import { directionBucket, projectilePixels, PROJECTILE_ROTATES } from "@/game/projectileSprite";

// 弾の絵。設計書 40.8 と 10.5。武器ごとに形を分け、進む向きに合わせて描き直す

const colors = (grid: ReturnType<typeof projectilePixels>) => new Set(Array.from(grid.pixels).filter(c => c !== TRANSPARENT));

describe("directionBucket", () => {
  it("右を 0 として 22.5 度ごとの 16 方向に丸める（y は下向き）", () => {
    expect(directionBucket(0)).toBe(0);
    expect(directionBucket(Math.PI / 2)).toBe(4);
    expect(directionBucket(-Math.PI / 2)).toBe(12);
    expect(directionBucket(Math.PI)).toBe(8);
    expect(directionBucket((11 * Math.PI) / 180)).toBe(0);
    expect(directionBucket((12 * Math.PI) / 180)).toBe(1);
  });
});

describe("projectilePixels", () => {
  it("8 種の武器がすべて違う絵で、固定パレットの色だけで描く", () => {
    const pictures = WEAPON_IDS.map(weapon => Array.from(projectilePixels(weapon, TEAM_RAMPS.orange, 0, 0).pixels).join());
    expect(new Set(pictures).size).toBe(WEAPON_IDS.length);
    for (const weapon of WEAPON_IDS) for (const angle of [0, 1, 2.5, -2]) for (const color of colors(projectilePixels(weapon, TEAM_RAMPS.cyan, angle, 1))) {
      expect(isPaletteColor(color), `${weapon} 0x${color.toString(16)}`).toBe(true);
    }
  });
  it("発射者の主色を残す。レーザー弾は殻が無く白とシアンで光る", () => {
    for (const weapon of WEAPON_IDS.filter(w => w !== "laser")) {
      const c = colors(projectilePixels(weapon, TEAM_RAMPS.pink, 0, 0));
      expect([TEAM_RAMPS.pink.light, TEAM_RAMPS.pink.base, TEAM_RAMPS.pink.shadow].some(x => c.has(x)), weapon).toBe(true);
    }
    const laser = colors(projectilePixels("laser", TEAM_RAMPS.pink, 0, 0));
    expect(laser.has(PALETTE.white)).toBe(true);
    expect(laser.has(PALETTE.energy1) || laser.has(PALETTE.energy2)).toBe(true);
    expect(laser.has(PALETTE.outline)).toBe(false);
  });
  it("向きのある弾は向きで描き直し、丸い弾（マルチ弾、掘削弾、浮遊弾）は向きで変えない", () => {
    for (const weapon of WEAPON_IDS) {
      const right = Array.from(projectilePixels(weapon, TEAM_RAMPS.red, 0, 0).pixels).join();
      const up = Array.from(projectilePixels(weapon, TEAM_RAMPS.red, -Math.PI / 2, 0).pixels).join();
      expect(right !== up, weapon).toBe(PROJECTILE_ROTATES[weapon]);
    }
  });
  it("右向きの長い弾は横長、上向きは縦長になる", () => {
    const right = opaqueBounds(projectilePixels("drill", TEAM_RAMPS.red, 0, 0))!, up = opaqueBounds(projectilePixels("drill", TEAM_RAMPS.red, -Math.PI / 2, 0))!;
    expect(right.width).toBeGreaterThan(right.height);
    expect(up.height).toBeGreaterThan(up.width);
  });
  it("掘削弾の導火線の火花はコマで瞬く", () => {
    expect(Array.from(projectilePixels("digger", TEAM_RAMPS.red, 0, 0).pixels).join()).not.toBe(Array.from(projectilePixels("digger", TEAM_RAMPS.red, 0, 1).pixels).join());
  });
});
