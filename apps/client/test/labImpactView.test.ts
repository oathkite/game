import type { TerrainMask } from "@game/sim";
import { describe, expect, it, vi } from "vitest";
import { CARVE_AT_MS, FLASH_MS_BY_TIER } from "@/game/hitFeedback";
import type { ProjectileView } from "@/game/projectileView";
import type { LabEffect, presentLabReplay } from "@/networkLab/labReplay";
import { createLabCrumbles, drawLabImpacts, labEdgePoints, labShake, labTankHit } from "@/worldUi/labImpactView";

// オンライン対戦の着弾の見せ方。設計書 38 の E1

type Presentation = ReturnType<typeof presentLabReplay>;
const effect = (clock: number, amount: number): LabEffect => ({ key: "0", cx: 20, cy: 15, radius: 6, clock, damage: amount, damages: amount > 0 ? [{ playerId: "p1", amount }] : [] });
const presentation = (effects: readonly LabEffect[]): Presentation => ({ players: [], terrainOps: [], bullets: [], trails: [], effects, hpBars: {}, misses: [], fallingIds: [], recoil: 0, shotFlashes: [] }) as Presentation;
const mask = (): TerrainMask => {
  const cells = new Uint8Array(40 * 30);
  for (let y = 15; y < 30; y++) for (let x = 0; x < 40; x++) cells[y * 40 + x] = 1;
  return { width: 40, height: 30, cells } as TerrainMask;
};
const view = () => ({ setBlast: vi.fn(), setDebris: vi.fn(), setInvert: vi.fn(), setMissMark: vi.fn(), setTrail: vi.fn(), setCrumble: vi.fn() });

describe("labTankHit", () => {
  it("爆風が最大になってから、ダメージの段階の長さだけ白くする", () => {
    expect(labTankHit(presentation([effect(CARVE_AT_MS - 1, 30)]), "p1").flash).toBe(false);
    expect(labTankHit(presentation([effect(CARVE_AT_MS, 30)]), "p1").flash).toBe(true);
    expect(labTankHit(presentation([effect(CARVE_AT_MS + FLASH_MS_BY_TIER[3], 30)]), "p1").flash).toBe(false);
    expect(labTankHit(presentation([effect(CARVE_AT_MS + FLASH_MS_BY_TIER[1], 10)]), "p1").flash).toBe(false);
    expect(labTankHit(presentation([effect(CARVE_AT_MS, 30)]), "p2").flash).toBe(false);
  });
});

describe("labShake", () => {
  it("被弾した着弾だけで揺らし、動きを減らす設定では揺らさない", () => {
    expect(labShake(presentation([effect(CARVE_AT_MS, 30)]), false)).not.toEqual({ dx: 0, dy: 0 });
    expect(labShake(presentation([effect(CARVE_AT_MS, 0)]), false)).toEqual({ dx: 0, dy: 0 });
    expect(labShake(presentation([effect(CARVE_AT_MS, 30)]), true)).toEqual({ dx: 0, dy: 0 });
    expect(labShake(presentation([]), false)).toEqual({ dx: 0, dy: 0 });
  });
});

describe("labEdgePoints", () => {
  it("被弾している機体だけを、頭の上の位置で返す", () => {
    const players = [{ playerId: "p1", x: 5, y: 20 }, { playerId: "p2", x: 9, y: 20 }];
    expect(labEdgePoints(presentation([effect(0, 30)]), players, () => 0xff0000)).toEqual([{ x: 5, y: 16, color: 0xff0000 }]);
    expect(labEdgePoints(presentation([effect(0, 0)]), players, () => 0)).toEqual([]);
  });
});

describe("drawLabImpacts", () => {
  it("爆風、破片、反転を描き、大ダメージの瞬間だけ反転する", () => {
    const v = view();
    drawLabImpacts(v as unknown as ProjectileView, presentation([effect(CARVE_AT_MS, 30)]), mask(), false);
    expect(v.setBlast).toHaveBeenCalledWith("0", 20, 15, 6, true, false);
    expect(v.setDebris).toHaveBeenCalled();
    expect(v.setInvert.mock.calls[0]![1]).not.toBeNull();
    const reduced = view();
    drawLabImpacts(reduced as unknown as ProjectileView, presentation([effect(CARVE_AT_MS, 30)]), mask(), true);
    expect(reduced.setInvert.mock.calls[0]![1]).toBeNull();
  });
});

describe("createLabCrumbles", () => {
  it("増えた削りの縁をかけらにして落とし、時間が過ぎたら消す", () => {
    const crumbles = createLabCrumbles(), v = view();
    crumbles.note(mask(), [{ cx: 20, cy: 15, radius: 6 }], 1000);
    crumbles.draw(v as unknown as ProjectileView, 1000);
    expect(v.setCrumble.mock.calls[0]![1].length).toBeGreaterThan(0);
    crumbles.draw(v as unknown as ProjectileView, 1500);
    expect(v.setCrumble.mock.calls[1]![1]).toEqual([]);
  });
  it("まとめて届いた削り（再接続など）ではかけらを出さない", () => {
    const crumbles = createLabCrumbles(), v = view();
    crumbles.note(mask(), Array.from({ length: 9 }, (_, i) => ({ cx: i * 4, cy: 15, radius: 2 })), 0);
    crumbles.draw(v as unknown as ProjectileView, 0);
    expect(v.setCrumble).not.toHaveBeenCalled();
  });
});
