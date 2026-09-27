import { describe, expect, it } from "vitest";
import { composeTables, COOL_TABLE, DIM_TABLE, HIT_TABLE, KILL_TABLE, WARM_TABLE } from "@/game/fx/gradeTables";
import { isPaletteColor, PALETTE } from "@/game/palette";

// 暗転と空の色の寄せの置き換え表（設計書 41.13 の評価と改善の 2 回目）。置き換えても描く画素はパレットの色のまま

const luminance = (c: number): number => 0.2126 * ((c >> 16) & 0xff) + 0.7152 * ((c >> 8) & 0xff) + 0.0722 * (c & 0xff);

describe("置き換え表", () => {
  it("どの表も、元も先もパレットの色だけ", () => {
    for (const table of [DIM_TABLE, WARM_TABLE, COOL_TABLE, HIT_TABLE, KILL_TABLE]) {
      for (const [from, to] of table) {
        expect(isPaletteColor(from)).toBe(true);
        expect(isPaletteColor(to)).toBe(true);
      }
    }
  });
  it("暗転は各色を暗い色へ送り、地形と空の色をすべて含む", () => {
    for (const [from, to] of DIM_TABLE) expect(luminance(to)).toBeLessThan(luminance(from));
    for (const c of [PALETTE.sky1, PALETTE.sky4, PALETTE.green, PALETTE.loam0, PALETTE.stone1, PALETTE.ochre0, PALETTE.violet0]) expect(DIM_TABLE.has(c)).toBe(true);
  });
  it("掘削弾は空を暖かく、撃破は赤く寄せる", () => {
    const red = (c: number) => (c >> 16) & 0xff, blue = (c: number) => c & 0xff;
    expect(red(WARM_TABLE.get(PALETTE.sky3)!)).toBeGreaterThan(blue(WARM_TABLE.get(PALETTE.sky3)!));
    expect(red(KILL_TABLE.get(PALETTE.sky4)!)).toBeGreaterThan(blue(KILL_TABLE.get(PALETTE.sky4)!) * 2);
    expect(blue(COOL_TABLE.get(PALETTE.sky3)!)).toBeGreaterThanOrEqual(red(COOL_TABLE.get(PALETTE.sky3)!));
  });
  it("続けて当てると、先の表の結果に後の表を当てる", () => {
    const both = composeTables(DIM_TABLE, KILL_TABLE);
    // sky4 は暗転で sky3、撃破の表で sky3 は fire5
    expect(both.get(PALETTE.sky4)).toBe(KILL_TABLE.get(PALETTE.sky3));
    expect(both.get(PALETTE.loam0)).toBe(DIM_TABLE.get(PALETTE.loam0));
  });
});
