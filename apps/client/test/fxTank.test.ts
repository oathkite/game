import { describe, expect, it, vi } from "vitest";
import { muzzleSmoke, trackDust, wreckDebris } from "@/game/fx/impactFx";
import { knockbackAt, KNOCKBACK_BACK_MS, KNOCKBACK_OUT_MS } from "@/game/hitFeedback";
import { PALETTE, TEAM_RAMPS } from "@/game/palette";
import { getPixel, TRANSPARENT } from "@/game/pixelGrid";
import { antennaMask } from "@/game/tankShape";
import { ANTENNA_PERIOD_MS, antennaSwayAt } from "@/game/tankMotion";
import type { LabEffect, presentLabReplay } from "@/networkLab/labReplay";
import { createLabImpactFx, labTankHit } from "@/worldUi/labImpactView";

// 機体の揺れものと被弾の見せ方（設計書 41 の段階 4）を数値で固定する

describe("antennaSwayAt", () => {
  it("最初の振れから 1 周期ごとに半分になり、1 art px 未満で止まる", () => {
    expect(antennaSwayAt(0, -3, false)).toBe(-3);
    expect(antennaSwayAt(ANTENNA_PERIOD_MS / 2, -3, false)).toBe(2);
    expect(antennaSwayAt(ANTENNA_PERIOD_MS * 4, -3, false)).toBe(0);
    expect(antennaSwayAt(0, -3, true)).toBe(0);
  });
});

describe("antennaMask", () => {
  it("付け根は動かさず、先端だけを横へずらして曲げる", () => {
    const straight = antennaMask(0), bent = antennaMask(0, 2);
    expect(getPixel(straight, -6, -25)).not.toBe(TRANSPARENT);
    expect(getPixel(bent, -4, -25)).not.toBe(TRANSPARENT);
    expect(getPixel(bent, -6, -20)).not.toBe(TRANSPARENT);
  });
});

describe("knockbackAt", () => {
  it("ダメージ段階で 1、2、2 art px 押し、60 ms で押して 120 ms で戻る", () => {
    expect(knockbackAt(10, 5)).toBe(1);
    expect(knockbackAt(10, 20)).toBe(2);
    expect(knockbackAt(10, 35)).toBe(2);
    expect(knockbackAt(KNOCKBACK_OUT_MS + KNOCKBACK_BACK_MS, 35)).toBe(0);
    expect(knockbackAt(-1, 35)).toBe(0);
    expect(knockbackAt(10, 0)).toBe(0);
  });
});

describe("発射と走行と撃破の粒", () => {
  it("煙の輪は 8 粒で飛び出す向きへ流れ、土煙は後ろへ 2 粒、撃破は 24 粒を上へ散らす", () => {
    const smoke = muzzleSmoke(10, 10, 0, 1);
    expect(smoke.count).toBe(8);
    expect(Array.from(smoke.vx).every((v) => v > 0)).toBe(true);
    const dust = trackDust(10, 10, 1, [PALETTE.loam1, PALETTE.loam2], 1);
    expect(dust.count).toBe(2);
    expect(Array.from(dust.vx).every((v) => v < 0)).toBe(true);
    const ramp = TEAM_RAMPS.red;
    const wreck = wreckDebris(10, 10, [ramp.light, ramp.base, PALETTE.metal1], 1);
    expect(wreck.count).toBe(24);
    expect(Array.from(wreck.vy).every((v) => v < 0)).toBe(true);
  });
});

type Presentation = ReturnType<typeof presentLabReplay>;
const effect = (clock: number, over: Partial<LabEffect> = {}): LabEffect => ({ key: "0", cx: 20, cy: 15, radius: 6, clock, damage: 35, damages: [{ playerId: "p1", amount: 35 }], kills: [], final: false, ...over });
const presentation = (effects: readonly LabEffect[], launches: Presentation["launches"] = []): Presentation => ({ teleport: null, launches, players: [], terrainOps: [], bullets: [], trails: [], effects, hpBars: {}, misses: [], fallingIds: [], recoil: 0, shotFlashes: [] }) as Presentation;

describe("オンラインの押し戻しと煙の輪と撃破の破片", () => {
  it("爆心から遠ざかる向きに押す", () => {
    expect(labTankHit(presentation([effect(200)]), "p1", 30).nudge).toBeGreaterThan(0);
    expect(labTankHit(presentation([effect(200)]), "p1", 10).nudge).toBeLessThan(0);
    expect(labTankHit(presentation([effect(100)]), "p1", 30).nudge).toBe(0);
  });
  it("煙の輪は弾道ごとに 1 回、撃破では機体の色の破片を出す", () => {
    const fx = createLabImpactFx(), api = { impact: vi.fn(), killFlash: vi.fn(), freeze: vi.fn(), launch: vi.fn(), wreck: vi.fn(), teleport: vi.fn() };
    const launches = [{ key: "0", x: 10, y: 10, angle: 0, age: 5, points: [{ x: 10, y: 10, at: 0 }, { x: 12, y: 9, at: 16 }] }];
    fx.update(api, presentation([], launches), { startsAt: 1, terrainOpsBefore: 0 }, "m", false);
    fx.update(api, presentation([effect(0, { kills: ["p1"] })], launches), { startsAt: 1, terrainOpsBefore: 0 }, "m", false, () => ({ x: 20, y: 15, ramp: TEAM_RAMPS.red }));
    expect(api.launch).toHaveBeenCalledTimes(1);
    expect(api.launch.mock.calls[0]![3]).toBe(5);
    expect(api.wreck).toHaveBeenCalledTimes(1);
  });
});
