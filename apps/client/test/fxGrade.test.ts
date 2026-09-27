import { describe, expect, it } from "vitest";
import { brighterHalf, composeTables, DIM_TABLE, FLOATER_TABLE, KILL_TABLE, LASER_TABLE, WARM_TABLE } from "@/game/fx/gradeTables";
import { isPaletteColor, PALETTE } from "@/game/palette";

// 暗転と空の色の寄せの置き換え表（設計書 41.13 の評価と改善の 2 回目）。置き換えても描く画素はパレットの色のまま

const luminance = (c: number): number => 0.2126 * ((c >> 16) & 0xff) + 0.7152 * ((c >> 8) & 0xff) + 0.0722 * (c & 0xff);

describe("置き換え表", () => {
  it("どの表も、元も先もパレットの色だけ", () => {
    for (const table of [DIM_TABLE, WARM_TABLE, LASER_TABLE, FLOATER_TABLE, KILL_TABLE]) {
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
    expect(blue(LASER_TABLE.get(PALETTE.sky3)!)).toBeGreaterThanOrEqual(red(LASER_TABLE.get(PALETTE.sky3)!));
    // 浮遊弾はレーザー弾と違う青。空のいちばん上の帯も置き換え、継ぎ目を出さない
    expect(FLOATER_TABLE.get(PALETTE.sky3)).not.toBe(LASER_TABLE.get(PALETTE.sky3));
    for (const table of [WARM_TABLE, LASER_TABLE, FLOATER_TABLE, KILL_TABLE]) expect(table.has(PALETTE.sky0)).toBe(true);
  });
  it("掘削弾の近い山並みは、地面（土の明るい 3 段）より暗い", () => {
    const lum = (c: number) => 0.2126 * ((c >> 16) & 0xff) + 0.7152 * ((c >> 8) & 0xff) + 0.0722 * (c & 0xff);
    expect(lum(WARM_TABLE.get(PALETTE.sky1)!)).toBeLessThan(lum(PALETTE.loam2));
  });
  it("入りと戻りの段は、明るい半分の色だけを置き換える", () => {
    const half = brighterHalf(KILL_TABLE);
    expect(half.size).toBe(Math.ceil(KILL_TABLE.size / 2));
    expect(half.has(PALETTE.sky4)).toBe(true);
    expect(half.has(PALETTE.sky0)).toBe(false);
  });
  it("続けて当てると、先の表の結果に後の表を当てる", () => {
    const both = composeTables(DIM_TABLE, KILL_TABLE);
    // sky4 は暗転で sky3、撃破の表で sky3 は fire5
    expect(both.get(PALETTE.sky4)).toBe(KILL_TABLE.get(PALETTE.sky3));
    expect(both.get(PALETTE.loam0)).toBe(DIM_TABLE.get(PALETTE.loam0));
  });
});
