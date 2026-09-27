import { describe, expect, it } from "vitest";
import { DRIFT_COUNT, driftLightAt } from "@/game/driftLights";
import { PALETTE } from "@/game/palette";
import { getPixel, TRANSPARENT } from "@/game/pixelGrid";
import { MOUNTAIN_PERIOD, paintTrees, TREE_HEIGHT } from "@/game/skyPaint";

// 世界の動き（設計書 41 の段階 6）。3 層目の遠景と漂う光

describe("paintTrees", () => {
  it("周期の左端と右端がつながり、繰り返しても継ぎ目が出ない", () => {
    for (const theme of ["ridge", "canyon", "basin"] as const) {
      const g = paintTrees(theme);
      expect(g.width).toBe(MOUNTAIN_PERIOD);
      for (let y = 0; y < TREE_HEIGHT; y++) {
        const left = getPixel(g, 0, y) !== TRANSPARENT, right = getPixel(g, MOUNTAIN_PERIOD - 1, y) !== TRANSPARENT;
        // 端の画素が片方だけ塗られていても、隣の 1 画素に塗りがあれば形はつながっている
        if (left !== right) expect(getPixel(g, left ? MOUNTAIN_PERIOD - 2 : 1, y) !== TRANSPARENT || getPixel(g, left ? 1 : MOUNTAIN_PERIOD - 2, y) !== TRANSPARENT).toBe(true);
      }
    }
  });
  it("いちばん暗い夜空の色だけで塗り、下端はふさぐ。浮島では描かない", () => {
    const g = paintTrees("ridge");
    const colors = new Set(Array.from(g.pixels).filter((c) => c !== TRANSPARENT));
    expect([...colors]).toEqual([PALETTE.sky0]);
    expect(getPixel(g, 100, TREE_HEIGHT - 1)).toBe(PALETTE.sky0);
    expect(Array.from(paintTrees("islands").pixels).every((c) => c === TRANSPARENT)).toBe(true);
  });
});

describe("driftLightAt", () => {
  it("画面の下半分あたりを漂い、動きを減らす設定では止まって点いたまま", () => {
    for (let i = 0; i < DRIFT_COUNT; i++) {
      const p = driftLightAt(i, 5000, false);
      expect(p.y).toBeGreaterThan(0.4);
      expect(p.y).toBeLessThan(0.9);
      expect(driftLightAt(i, 5000, true)).toEqual(driftLightAt(i, 0, true));
      expect(driftLightAt(i, 5000, true).on).toBe(true);
    }
  });
  it("時間とともに明滅する", () => {
    const states = Array.from({ length: 40 }, (_, k) => driftLightAt(3, k * 100, false).on);
    expect(states).toContain(true);
    expect(states).toContain(false);
  });
});
