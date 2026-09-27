import { describe, expect, it } from "vitest";
import { DRIFT_COUNT, driftLightAt } from "@/game/driftLights";
import { PALETTE } from "@/game/palette";
import { getPixel, TRANSPARENT } from "@/game/pixelGrid";
import { MOUNTAIN_PERIOD, paintTrees, shootingStarAt, SHOOTING_MS, SHOOTING_WINDOW_MS, TREE_HEIGHT } from "@/game/skyPaint";
import { EXHAUST_PERIOD_MS, EXHAUST_VISIBLE_MS, exhaustAt } from "@/game/tankMotion";

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
  it("遠景の木の帯と地平の近くに集まり、どの光も 1.1 秒の間に 1 回は点いて消える", () => {
    for (let i = 0; i < DRIFT_COUNT; i++) {
      const y = driftLightAt(i, 7000, false).y;
      expect(y).toBeGreaterThan(0.44);
      expect(y).toBeLessThan(0.68);
      const states = Array.from({ length: 23 }, (_, k) => driftLightAt(i, 3000 + k * 50, false).on);
      expect(states).toContain(true);
      expect(states).toContain(false);
    }
  });
});

describe("shootingStarAt", () => {
  it("6 秒の窓ごとに 1 回だけ、450 ms で右下へ流れる。動きを減らす設定では流れない", () => {
    const seen: number[] = [];
    for (let t = 0; t < SHOOTING_WINDOW_MS * 3; t += 10) if (shootingStarAt(t, false)) seen.push(Math.floor(t / SHOOTING_WINDOW_MS));
    expect([...new Set(seen)]).toEqual([0, 1, 2]);
    const first = Array.from({ length: SHOOTING_WINDOW_MS / 10 }, (_, k) => k * 10).find((t) => shootingStarAt(t, false))!;
    expect(shootingStarAt(first + SHOOTING_MS / 2, false)!.travel).toBeGreaterThan(shootingStarAt(first, false)!.travel);
    expect(shootingStarAt(first, true)).toBeNull();
  });
});

describe("exhaustAt", () => {
  it("1.4 秒ごとに排気口から小さな煙が昇り、0.9 秒で消える", () => {
    expect(exhaustAt(0, false)).toMatchObject({ x: -15, y: -7, size: 1 });
    expect(exhaustAt(EXHAUST_VISIBLE_MS - 10, false)!.y).toBeLessThan(-7);
    expect(exhaustAt(EXHAUST_VISIBLE_MS + 10, false)).toBeNull();
    expect(exhaustAt(EXHAUST_PERIOD_MS, false)).toMatchObject({ x: -15, y: -7 });
    expect(exhaustAt(0, true)).toBeNull();
  });
});
