import { describe, expect, it } from "vitest";
import { HP_MAX } from "@game/sim";
import { PALETTE } from "@/game/palette";
import { hpBarRects } from "@/game/tankHpBar";

// 機体の下の HP バー。10 HP を 1 目盛りとし、輪郭と暗い地の上に目盛りを並べる（設計書 40.5）

describe("hpBarRects", () => {
  it("輪郭、暗い地、HP の目盛りの順に並べ、目盛りは 4 art px おきに 3 px 幅", () => {
    const rects = hpBarRects(HP_MAX, HP_MAX, false, 0x55c8ff);
    expect(rects[0]).toEqual({ x: -21, y: 7, w: 42, h: 6, color: PALETTE.outline });
    expect(rects[1]).toEqual({ x: -20, y: 8, w: 40, h: 4, color: PALETTE.sky0 });
    const ticks = rects.slice(2);
    expect(ticks).toHaveLength(10);
    expect(ticks.map(r => r.x)).toEqual([-20, -16, -12, -8, -4, 0, 4, 8, 12, 16]);
    for (const r of ticks) expect(r).toMatchObject({ w: 3, h: 4, color: 0x55c8ff });
  });
  it("HP の端数は切り上げて目盛りにし、0 以下なら目盛りを描かない", () => {
    expect(hpBarRects(31, 31, false, 1).length - 2).toBe(4);
    expect(hpBarRects(0, 0, false, 1).length - 2).toBe(0);
    expect(hpBarRects(-5, 0, false, 1).length - 2).toBe(0);
  });
  it("失った区間は明滅の点灯側だけ白で描く", () => {
    const on = hpBarRects(40, 70, true, 1).slice(2), off = hpBarRects(40, 70, false, 1).slice(2);
    expect(on.filter(r => r.color === PALETTE.white)).toHaveLength(3);
    expect(off.filter(r => r.color === PALETTE.white)).toHaveLength(0);
    expect(on.filter(r => r.color === 1)).toHaveLength(4);
  });
});
