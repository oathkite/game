import { describe, expect, it } from "vitest";
import { WEAPON_IDS } from "@game/protocol";
import { isPaletteColor } from "@/game/palette";
import { opaqueBounds, TRANSPARENT } from "@/game/pixelGrid";
import { ICON_VIEW, iconShift, weaponIconGrid } from "@/worldUi/weaponIconGrid";

// 武器のアイコン。設計書 40.10。40.8 の弾の絵から作り、13 × 13 art px の枠に収める（52 px で 1 art px = 4 px）

describe("weaponIconGrid", () => {
  it("8 種すべてが枠に収まり、違う絵で、固定パレットの色だけを使う", () => {
    const pictures = new Set<string>();
    for (const weapon of WEAPON_IDS) {
      const grid = weaponIconGrid(weapon);
      const b = opaqueBounds(grid)!;
      expect(b.left).toBeGreaterThanOrEqual(ICON_VIEW.left);
      expect(b.top).toBeGreaterThanOrEqual(ICON_VIEW.top);
      expect(b.left + b.width).toBeLessThanOrEqual(ICON_VIEW.left + ICON_VIEW.width);
      expect(b.top + b.height).toBeLessThanOrEqual(ICON_VIEW.top + ICON_VIEW.height);
      for (const c of grid.pixels) if (c !== TRANSPARENT) expect(isPaletteColor(c)).toBe(true);
      pictures.add(Array.from(grid.pixels).join());
    }
    expect(pictures.size).toBe(WEAPON_IDS.length);
  });
  it("どの武器も、動かした絵の中心が表示の中心に来る。動かす量は 0.5 art px 単位", () => {
    for (const weapon of WEAPON_IDS) {
      const grid = weaponIconGrid(weapon), b = opaqueBounds(grid)!, shift = iconShift(grid);
      expect(b.left + b.width / 2 + shift.x).toBe(ICON_VIEW.left + ICON_VIEW.width / 2);
      expect(b.top + b.height / 2 + shift.y).toBe(ICON_VIEW.top + ICON_VIEW.height / 2);
      expect(Number.isInteger(shift.x * 2) && Number.isInteger(shift.y * 2)).toBe(true);
    }
  });
  it("トリプル弾は 3 発、マルチ弾は 3 粒を並べる", () => {
    const count = (weapon: (typeof WEAPON_IDS)[number]) => Array.from(weaponIconGrid(weapon).pixels).filter(c => c !== TRANSPARENT).length;
    expect(count("triple")).toBeGreaterThan(count("cannon"));
    expect(count("multiple")).toBeGreaterThan(count("cannon"));
  });
});
