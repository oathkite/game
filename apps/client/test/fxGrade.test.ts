import { describe, expect, it } from "vitest";
import { brighterHalf, composeTables, DIM_TABLE, FLOATER_TABLE, KILL_TABLE, LASER_TABLE, WARM_TABLE } from "@/game/fx/gradeTables";
import { nextTint, TINT_EDGE_MS, tintPhaseAt } from "@/game/fx/screenFx";
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

describe("空の色の寄せの段", () => {
  const warm = { table: WARM_TABLE, from: 1000, ms: 450, entry: true };
  it("入りと戻りの 70 ms は明るい半分の段、その間はすべて、外は寄せない", () => {
    expect(tintPhaseAt(warm, 999)).toBeNull();
    expect(tintPhaseAt(warm, 1000)).toBe("edge");
    expect(tintPhaseAt(warm, 1000 + TINT_EDGE_MS)).toBe("full");
    expect(tintPhaseAt(warm, 1450 - TINT_EDGE_MS)).toBe("edge");
    expect(tintPhaseAt(warm, 1450)).toBeNull();
  });
  it("全画面の白から入る寄せ（撃破）は、入りの段を挟まずにすべてを置き換える", () => {
    expect(tintPhaseAt({ table: KILL_TABLE, from: 1000, ms: 500, entry: false }, 1000)).toBe("full");
  });
  it("同じ表が効いている間に続けて当たると、始まりを保って終わりだけ延ばす（レーザー弾の 7 段）", () => {
    const laser = { table: LASER_TABLE, from: 1000, ms: 200, entry: true };
    expect(nextTint(laser, { ...laser, from: 1150 })).toEqual({ ...laser, ms: 350 });
    expect(tintPhaseAt(nextTint(laser, { ...laser, from: 1150 }), 1100)).toBe("full");
  });
  it("別の表や、効き終わった後の同じ表は、新しい寄せとしてやり直す", () => {
    const laser = { table: LASER_TABLE, from: 1000, ms: 200, entry: true };
    const kill = { table: KILL_TABLE, from: 1100, ms: 500, entry: false };
    expect(nextTint(laser, kill)).toBe(kill);
    expect(nextTint(laser, { ...laser, from: 1300 })).toEqual({ ...laser, from: 1300 });
    expect(nextTint(null, laser)).toBe(laser);
  });
});
