import { WEAPON_IDS } from "@game/protocol";
import { describe, expect, it } from "vitest";
import { debrisPowerOf, impactPaletteOf, TRAIL_STYLES, weaponTrail } from "@/game/fx/weaponFx";
import { PALETTE } from "@/game/palette";

// 武器ごとの軌跡と着弾の色（設計書 41 の段階 5）を数値で固定する

const line = [{ x: 0, y: 0, at: 0 }, { x: 50, y: -20, at: 500 }, { x: 100, y: 0, at: 1000 }];

describe("weaponTrail", () => {
  it("決まった間隔で、弾がその点を通る時刻に通った位置へ粒を置く", () => {
    const b = weaponTrail("cannon", line, 1)!;
    expect(b.count).toBe(Math.floor(1000 / TRAIL_STYLES.cannon!.every));
    expect(b.t0[0]).toBe(TRAIL_STYLES.cannon!.every);
    const mid = Math.round(500 / TRAIL_STYLES.cannon!.every) - 1;
    expect(b.x0[mid]! / 4).toBeCloseTo(50 * (b.t0[mid]! / 500), 0);
    for (let i = 1; i < b.count; i++) expect(b.t0[i]).toBeGreaterThan(b.t0[i - 1]!);
  });
  it("貫通弾と掘削弾は軌跡の粒を出さず、点が 1 つなら出さない", () => {
    expect(weaponTrail("drill", line, 1)).toBeNull();
    expect(weaponTrail("digger", line, 1)).toBeNull();
    expect(weaponTrail("cannon", [line[0]!], 1)).toBeNull();
  });
  it("軌跡の色は武器ごとに違う", () => {
    const firsts = new Set(WEAPON_IDS.flatMap((w) => (TRAIL_STYLES[w] ? [`${TRAIL_STYLES[w]!.ramp[0]}/${TRAIL_STYLES[w]!.size}/${TRAIL_STYLES[w]!.every}`] : [])));
    expect(firsts.size).toBe(WEAPON_IDS.filter((w) => TRAIL_STYLES[w]).length);
  });
});

describe("着弾の色と破片の勢い", () => {
  it("レーザー弾と浮遊弾は発光色、ほかは炎の色。掘削弾は破片を強く噴き上げる", () => {
    expect(impactPaletteOf("laser").lightInner).toBe(PALETTE.energy0);
    expect(impactPaletteOf("floater").sparks).toContain(PALETTE.energy1);
    expect(impactPaletteOf("cannon").lightInner).toBe(PALETTE.fire1);
    expect(debrisPowerOf("digger")).toBeGreaterThan(1);
    expect(debrisPowerOf("cannon")).toBe(1);
  });
});
