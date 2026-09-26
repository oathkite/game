import { describe, expect, it } from "vitest";
import { TANK_RADIUS } from "@game/sim";
import { isPaletteColor, PALETTE } from "@/game/palette";
import { getPixel, opaqueBounds, TRANSPARENT } from "@/game/pixelGrid";
import { TARGET_HEIGHT } from "@/practice/rules";
import { targetPixels } from "@/game/targetSprite";

// 練習の的。設計書 40.8。的の中心（地面から 8 セル上）を原点とする art px

describe("targetPixels", () => {
  const grid = targetPixels();
  it("的の円は当たりの半径（3 セル）に収まり、柱は地面まで届く", () => {
    const b = opaqueBounds(grid)!;
    expect(b.left).toBeGreaterThanOrEqual(-TANK_RADIUS * 4 - 1);
    expect(b.left + b.width).toBeLessThanOrEqual(TANK_RADIUS * 4 + 1);
    expect(b.top).toBeGreaterThanOrEqual(-TANK_RADIUS * 4 - 1);
    expect(b.top + b.height).toBe(TARGET_HEIGHT * 4);
  });
  it("中心は赤、外へ白と赤が交互に並び、輪郭で囲む", () => {
    expect(getPixel(grid, 0, 0)).toBe(PALETTE.fire4);
    const colors = new Set(Array.from(grid.pixels).filter(c => c !== TRANSPARENT));
    expect(colors.has(PALETTE.white)).toBe(true);
    expect(colors.has(PALETTE.outline)).toBe(true);
    for (const c of colors) expect(isPaletteColor(c)).toBe(true);
  });
});
