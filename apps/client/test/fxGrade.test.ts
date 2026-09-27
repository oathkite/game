import { describe, expect, it, vi } from "vitest";
import type { FxLayer } from "@/game/fx/fxLayer";
import { brighterHalf, composeTables, DIM_TABLE, FLOATER_TABLE, KILL_TABLE, LASER_TABLE, TINT_PRIORITY, WARM_TABLE, type GradeTable, type TintPriority } from "@/game/fx/gradeTables";
import { createRendererEffects } from "@/game/fx/rendererEffects";
import { createScreenFx, nextTint, nextTints, shownTint, TINT_EDGE_MS, tintPhaseAt, type ScreenFx, type Tint } from "@/game/fx/screenFx";
import { HOLD_MS, HP_DRAIN_MS } from "@/game/hitFeedback";
import { isPaletteColor, PALETTE } from "@/game/palette";

// 暗転と空の色の寄せの置き換え表（設計書 41.13 の評価と改善の 2 回目）。置き換えても描く画素はパレットの色のまま

// フィルターは canvas と WebGL が要るので、受け取った表を覚えるだけのものに替える
vi.mock("@/game/fx/gradeFilter", () => ({
  createGradeFilter: () => {
    const filter = { tables: [] as unknown[] };
    return { filter, setTable: (table: unknown) => { filter.tables.push(table); }, setStrength: () => {}, setSpot: () => {}, setPixel: () => {}, destroy: () => {} };
  },
}));

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
  const warm = { table: WARM_TABLE, from: 1000, ms: 450, entry: true, priority: TINT_PRIORITY.weapon };
  it("入りと戻りの 70 ms は明るい半分の段、その間はすべて、外は寄せない", () => {
    expect(tintPhaseAt(warm, 999)).toBeNull();
    expect(tintPhaseAt(warm, 1000)).toBe("edge");
    expect(tintPhaseAt(warm, 1000 + TINT_EDGE_MS)).toBe("full");
    expect(tintPhaseAt(warm, 1450 - TINT_EDGE_MS)).toBe("edge");
    expect(tintPhaseAt(warm, 1450)).toBeNull();
  });
  it("全画面の白から入る寄せ（撃破）は、入りの段を挟まずにすべてを置き換える", () => {
    expect(tintPhaseAt({ table: KILL_TABLE, from: 1000, ms: 500, entry: false, priority: TINT_PRIORITY.kill }, 1000)).toBe("full");
  });
  it("同じ表が効いている間に続けて当たると、始まりを保って終わりだけ延ばす（レーザー弾の 7 段）", () => {
    const laser = { table: LASER_TABLE, from: 1000, ms: 200, entry: true, priority: TINT_PRIORITY.weapon };
    expect(nextTint(laser, { ...laser, from: 1150 })).toEqual({ ...laser, ms: 350 });
    expect(tintPhaseAt(nextTint(laser, { ...laser, from: 1150 }), 1100)).toBe("full");
  });
  it("別の表や、効き終わった後の同じ表は、新しい寄せとしてやり直す", () => {
    const laser = { table: LASER_TABLE, from: 1000, ms: 200, entry: true, priority: TINT_PRIORITY.weapon };
    const floater = { table: FLOATER_TABLE, from: 1100, ms: 500, entry: true, priority: TINT_PRIORITY.weapon };
    expect(nextTint(laser, floater)).toBe(floater);
    expect(nextTint(laser, { ...laser, from: 1300 })).toEqual({ ...laser, from: 1300 });
    expect(nextTint(null, laser)).toBe(laser);
  });
});

describe("撃破と武器の空の色の寄せ", () => {
  // レーザー弾の 1 段目が 1000 に当たって撃破する。寄せは 1070 から、削る瞬間（1190）に HP バーが減りきる 1590 の撃破を予約する。
  // 後の段は 64〜80 ms おきに続く（FX ラボで測った削る時刻の間隔）
  const laserAt = (from: number) => ({ table: LASER_TABLE, from, ms: 200, entry: true, priority: TINT_PRIORITY.weapon });
  const kill = { table: KILL_TABLE, from: 1590, ms: 500, entry: false, priority: TINT_PRIORITY.kill };
  const laserKill = [1150, 1214, 1294, 1358, 1422, 1502].reduce((tints, from) => nextTints(tints, laserAt(from)), nextTints(nextTints([], laserAt(1070)), kill));
  it("撃破の寄せを予約した後に武器の寄せが続いても、撃破の間は撃破の寄せを当てる", () => {
    // 1 つで持つと、後の段が予約中の撃破の寄せを置き換え、白の後に赤が出なかった
    expect(shownTint(laserKill, 1590)).toBe(kill);
    expect(tintPhaseAt(shownTint(laserKill, 1590), 1590)).toBe("full");
    expect(shownTint(laserKill, 1650)).toBe(kill);
  });
  it("撃破の寄せが始まるまでは、効いている武器の寄せを当てる", () => {
    // 1 つで持つと、撃破の予約が効いているレーザー弾の寄せを消し、後の段が当たるまで元の夜空に戻った
    expect(shownTint(nextTints(nextTints([], laserAt(1070)), kill), 1200)?.table).toBe(LASER_TABLE);
    expect(shownTint(laserKill, 1200)?.table).toBe(LASER_TABLE);
    expect(shownTint(laserKill, 1589)?.table).toBe(LASER_TABLE);
    expect(shownTint(nextTints(nextTints([], kill), laserAt(1300)), 1400)?.table).toBe(LASER_TABLE);
  });
  it("撃破の寄せが戻りの段に入るか終わった後は、効いている武器の寄せを当てる", () => {
    const tints = nextTints(nextTints([], kill), laserAt(2000));
    expect(shownTint(tints, 2019)).toBe(kill);
    // 戻りの段（明るい半分だけ）を挟むと、武器の寄せへ移る前に元の空の色が見える
    expect(shownTint(tints, 2020)?.table).toBe(LASER_TABLE);
    expect(shownTint(tints, 2100)?.table).toBe(LASER_TABLE);
    expect(shownTint(nextTints(tints, laserAt(2300)), 2400)?.table).toBe(LASER_TABLE);
    expect(shownTint(tints, 2200)).toBeNull();
    // 下に効いている寄せがなければ、戻りの段で元の空へ戻す
    expect(shownTint([kill], 2050)).toBe(kill);
  });
  it("練習と同じ順（着弾、削る瞬間の撃破、後の段の着弾）で演出を呼んでも、白の時刻には撃破の寄せを当てる", () => {
    let now = 0, tints: readonly Tint[] = [];
    const fx = { now: () => now, emit: () => {}, clear: () => {}, count: () => 0, freeze: () => {} } as unknown as FxLayer;
    const tintAt = (table: GradeTable, from: number, ms: number, entry = true, priority: TintPriority = TINT_PRIORITY.weapon) => { tints = nextTints(tints, { table, from, ms, entry, priority }); };
    const screenFx = { tick: () => {}, clear: () => {}, dimAt: () => {}, flashAt: () => {}, tintAt } as unknown as ScreenFx;
    const effects = createRendererEffects({ fx, screenFx, texels: undefined, screen: () => ({ width: 100, height: 100 }), reduced: () => false, soil: [PALETTE.loam1] });
    const hit = (at: number) => { now = at; effects.impact({ cx: 10, cy: 10, radius: 3, tier: 0, seed: 1, age: -HOLD_MS, weapon: "laser" }); };
    [1000, 1080, 1144].forEach(hit);
    now = 1190;
    effects.killFlash(HP_DRAIN_MS);
    [1224, 1288, 1352, 1432].forEach(hit);
    expect(shownTint(tints, 1200)?.table).toBe(LASER_TABLE);
    expect(shownTint(tints, 1590)?.table).toBe(KILL_TABLE);
  });
});

describe("空のフィルターに送る表", () => {
  it("武器の寄せ、白の時刻からの撃破の寄せ、撃破の後も効いている武器の寄せの順に、表を送り直す", () => {
    // 武器の寄せの長さは、撃破の前後で効いているところを見るためのもの
    const view = { terrain: { filters: null }, sky: { filters: null as readonly { readonly tables: readonly unknown[] }[] | null }, toScreen: () => ({ x: 0, y: 0 }), cell: () => 8 };
    const screenFx = createScreenFx(view as unknown as Parameters<typeof createScreenFx>[0]);
    const skyAt = (now: number): unknown => { screenFx.tick(now, { width: 100, height: 100 }, 16); return view.sky.filters?.[0]?.tables.at(-1) ?? null; };
    screenFx.tintAt(LASER_TABLE, 1000, 1200);
    screenFx.tintAt(KILL_TABLE, 1500, 500, false, TINT_PRIORITY.kill);
    expect(skyAt(1100)).toBe(LASER_TABLE);
    expect(skyAt(1500)).toBe(KILL_TABLE);
    expect(skyAt(2100)).toBe(LASER_TABLE);
    expect(skyAt(2300)).toBeNull();
  });
});
