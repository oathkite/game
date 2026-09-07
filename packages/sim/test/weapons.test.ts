import { describe, expect, it } from "vitest";
import { BLAST_RADIUS, DAMAGE_MAX, DAMAGE_PER_CELL, damageAt, flatMask, HP_MAX, ONE, shot, simulateShot, WEAPON_SPECS, weaponSpec } from "../src/index.js";
import type { WeaponId } from "@game/protocol";

// 武器の手触りを数値で固定する。設計書 10 の 10.2 と 10.3。
// 数値そのものではなく「どちらが遠くへ飛ぶか」「どちらが風に流されるか」という関係を固定し、調整の余地を残す。

const WEAPONS = Object.keys(WEAPON_SPECS) as WeaponId[];

type Flight = { readonly range: number; readonly apex: number; readonly steps: number };

/** 平地の左端から仰角 45 度で撃ったときの到達距離、最高点の高さ、飛行ステップ数 */
const flight = (weapon: WeaponId, power: number, wind: number): Flight => {
  const surface = 200;
  const out = simulateShot(flatMask(surface), [{ x: 20, hp: 100 }, { x: 399, hp: 100 }], shot({ weapon, x: 20, elevation: 45, power, wind }));
  const impactX = out.result.impact?.x ?? 399;
  const apex = surface - Math.min(...out.path.map((p) => p.y)) / ONE;
  return { range: impactX - 20, apex, steps: out.path.length };
};

const drift = (weapon: WeaponId, power: number): number => flight(weapon, power, 10).range - flight(weapon, power, 0).range;

describe("武器の数値", () => {
  it("標準砲は設計書 01 と 06 の初期値そのままで、倍率はすべて 100%", () => {
    expect(weaponSpec("cannon")).toEqual({
      blastRadius: BLAST_RADIUS,
      damageMax: DAMAGE_MAX,
      damagePerCell: DAMAGE_PER_CELL,
      speedPercent: 100,
      gravityPercent: 100,
      windPercent: 100,
    });
  });

  it("どの武器も直撃 1 発では沈まず、メインウェポンは直撃 3 発以内で沈む", () => {
    for (const w of WEAPONS) expect(weaponSpec(w).damageMax, w).toBeLessThan(HP_MAX);
    for (const w of ["cannon", "heavy", "sniper"] as const) expect(weaponSpec(w).damageMax * 3, w).toBeGreaterThanOrEqual(HP_MAX);
  });

  it("爆風の端のダメージは 0 以上で、爆風の外は 0", () => {
    const center = { x: 100, y: 147 };
    for (const w of WEAPONS) {
      const spec = weaponSpec(w);
      const edge = spec.blastRadius + 3;
      expect(damageAt({ x: 100 + edge, y: 147 }, center, spec), w).toBeGreaterThanOrEqual(0);
      expect(damageAt({ x: 100 + edge + 1, y: 147 }, center, spec), w).toBe(0);
    }
  });
});

describe("メインウェポンの性格", () => {
  it("到達距離は 長砲 > 標準砲 > 重砲", () => {
    const [c, h, s] = [flight("cannon", 60, 0), flight("heavy", 60, 0), flight("sniper", 60, 0)];
    expect(s.range).toBeGreaterThan(c.range);
    expect(c.range).toBeGreaterThan(h.range);
    // 重砲の間合いは標準砲の 7 割から 8 割。それより狭いと相手に届く場所がなくなる
    expect(h.range / c.range).toBeGreaterThan(0.7);
    expect(h.range / c.range).toBeLessThan(0.8);
  });

  it("風 10 のずれは 長砲 が標準砲の 7 割未満で、重砲は標準砲より小さい", () => {
    const [c, h, s] = [drift("cannon", 60), drift("heavy", 60), drift("sniper", 60)];
    // 風の作用を半分にしても滞空が延びるぶん戻るので、ずれは半分にはならない
    expect(s).toBeLessThan(c * 0.7);
    expect(h).toBeLessThan(c);
  });

  it("爆風は 重砲 > 標準砲 > 長砲 で、直撃は 重砲 > 長砲 > 標準砲", () => {
    expect(weaponSpec("heavy").blastRadius).toBeGreaterThan(weaponSpec("cannon").blastRadius);
    expect(weaponSpec("cannon").blastRadius).toBeGreaterThan(weaponSpec("sniper").blastRadius);
    expect(weaponSpec("heavy").damageMax).toBeGreaterThan(weaponSpec("sniper").damageMax);
    expect(weaponSpec("sniper").damageMax).toBeGreaterThan(weaponSpec("cannon").damageMax);
  });
});

describe("サブウェポンの性格", () => {
  it("掘削弾は爆風が最も広く、直撃でも標準砲のかすり程度しか効かない", () => {
    const digger = weaponSpec("digger");
    for (const w of WEAPONS) if (w !== "digger") expect(digger.blastRadius).toBeGreaterThan(weaponSpec(w).blastRadius);
    expect(digger.damageMax).toBeLessThanOrEqual(DAMAGE_MAX - DAMAGE_PER_CELL * 6);
  });

  it("浮遊弾は標準砲と同じくらいの距離と高さを、3 割以上長い時間をかけて飛び、風 10 のずれは 3 倍以上", () => {
    const c = flight("cannon", 60, 0);
    const f = flight("floater", 60, 0);
    expect(f.range / c.range).toBeGreaterThan(0.85);
    expect(f.range / c.range).toBeLessThan(1.15);
    expect(f.apex / c.apex).toBeGreaterThan(0.85);
    expect(f.apex / c.apex).toBeLessThan(1.15);
    expect(f.steps).toBeGreaterThan(c.steps * 1.3);
    expect(drift("floater", 60)).toBeGreaterThanOrEqual(drift("cannon", 60) * 3);
  });

  it("針弾は直撃なら全武器で最大、着弾距離 3 セルで 1 割、4 セル以上は 0", () => {
    const stinger = weaponSpec("stinger");
    for (const w of WEAPONS) if (w !== "stinger") expect(stinger.damageMax).toBeGreaterThan(weaponSpec(w).damageMax);
    const center = { x: 100, y: 147 };
    expect(damageAt({ x: 100, y: 144 }, center, stinger)).toBe(stinger.damageMax);
    expect(damageAt({ x: 106, y: 147 }, center, stinger)).toBe(10);
    expect(damageAt({ x: 107, y: 147 }, center, stinger)).toBe(0);
  });
});
