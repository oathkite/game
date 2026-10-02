import { teleportPoseAt } from "@/game/teleportMotion";
import type { TerrainMask } from "@game/sim";
import { describe, expect, it, vi } from "vitest";
import { craterGlow, GLOW_MS, impactSmoke, impactSparks, lightBurst, SMOKE_LIMIT, SPARK_LIMIT } from "@/game/fx/impactFx";
import { createFrame, sampleBatch, type ArtBounds } from "@/game/fx/particles";
import { CARVE_AT_MS, HITSTOP_MS, hitstopClock, HOLD_MS, impactTimeMs } from "@/game/hitFeedback";
import { endsWithImpact } from "@/game/replay";
import { PALETTE } from "@/game/palette";
import type { LabEffect, presentLabReplay } from "@/networkLab/labReplay";
import { createLabImpactFx } from "@/worldUi/labImpactView";

// 着弾の層（設計書 41.6 の I1〜I4、41.7 の光）とヒットストップの見え方を数値で固定する

const WIDE: ArtBounds = { left: -100000, top: -100000, right: 100000, bottom: 100000 };

describe("impactSparks", () => {
  it("爆風半径 × 4 粒で上限 64、炎の段で冷え、多くは上へ飛ぶ", () => {
    expect(impactSparks(10, 10, 3, 1).count).toBe(12);
    expect(impactSparks(10, 10, 30, 1).count).toBe(SPARK_LIMIT);
    const b = impactSparks(10, 10, 10, 1);
    expect(b.ramps[0]![0]).toBe(PALETTE.white);
    expect(Array.from(b.vy).filter((v) => v < 0).length).toBeGreaterThan(b.count / 2);
    expect(Math.max(...Array.from(b.life))).toBeLessThanOrEqual(550);
  });
});

describe("impactSmoke", () => {
  it("爆風半径 × 2.5 粒で上限 40、遅れて生まれて昇り、風では流れない", () => {
    expect(impactSmoke(10, 10, 4, 1).count).toBe(10);
    expect(impactSmoke(10, 10, 40, 1).count).toBe(SMOKE_LIMIT);
    const b = impactSmoke(10, 10, 10, 1);
    expect(Array.from(b.t0).every((t) => t > 0)).toBe(true);
    expect(Array.from(b.vy).every((v) => v < 0)).toBe(true);
    expect(b.ramps[0]!.every((c) => c !== PALETTE.smoke0)).toBe(true);
  });
});

/** y が top より下が地面の mask */
const ground = (width: number, height: number, top: number): TerrainMask => {
  const cells = new Uint8Array(width * height);
  for (let y = top; y < height; y++) for (let x = 0; x < width; x++) cells[y * width + x] = 1;
  return { width, height, cells } as TerrainMask;
};
const carveOut = (mask: TerrainMask, cx: number, cy: number, r: number): TerrainMask => {
  const cells = new Uint8Array(mask.cells);
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) cells[y * mask.width + x] = 0;
  return { ...mask, cells };
};

describe("craterGlow", () => {
  const before = ground(60, 40, 20), op = { cx: 30, cy: 20, radius: 6 };
  const after = carveOut(before, op.cx, op.cy, op.radius);
  it("削れた口に面した残りの地形の texel だけを光らせ、2400 ms ±30% で冷ます", () => {
    const b = craterGlow(before, after, op, 3);
    expect(b.count).toBeGreaterThan(0);
    for (let i = 0; i < b.count; i++) {
      const cx = Math.floor(b.x0[i]! / 4), cy = Math.floor(b.y0[i]! / 4);
      expect(after.cells[cy * after.width + cx]).toBe(1);
      expect(b.life[i]).toBeGreaterThanOrEqual(GLOW_MS * 0.7);
      expect(b.life[i]).toBeLessThanOrEqual(GLOW_MS * 1.3);
      expect(b.vx[i]).toBe(0);
    }
    expect(b.ramps[0]!.at(-1)).toBe(PALETTE.fire6);
  });
  it("何も削れていなければ光らない", () => {
    expect(craterGlow(before, before, op, 3).count).toBe(0);
  });
});

describe("lightBurst", () => {
  const spec = { cx: 20, cy: 20, radius: 40, duration: 300, strength: 1, inner: PALETTE.fire1, outer: PALETTE.fire3 };
  it("最も明るいところでもドットの半分まで、中心から遠いほど少なく置く", () => {
    const b = lightBurst(spec);
    const c = (20 + 0.5) * 4;
    const near = Array.from({ length: b.count }, (_, i) => Math.hypot(b.x0[i]! + 0.5 - c, b.y0[i]! + 0.5 - c)).filter((d) => d < 8).length;
    expect(near).toBeLessThanOrEqual(Math.ceil(Math.PI * 64 * 0.5) + 8);
    expect(near).toBeGreaterThan(0);
    const far = Array.from({ length: b.count }, (_, i) => Math.hypot(b.x0[i]! + 0.5 - c, b.y0[i]! + 0.5 - c)).filter((d) => d > 32).length;
    expect(far).toBeLessThan(near);
  });
  it("時間とともに弱まり、内側の色は外側の色に変わってから消える", () => {
    const b = lightBurst(spec);
    const at = (t: number) => { const f = createFrame(b.count); sampleBatch(b, t, WIDE, f); return f; };
    const early = at(1), late = at(200);
    expect(late.n).toBeLessThan(early.n);
    expect(Array.from(early.color.subarray(0, early.n))).toContain(PALETTE.fire1);
    expect(at(300).n).toBe(0);
  });
  it("閾値は art px の座標で決まるので、同じ光源からは同じ模様になる", () => {
    expect(lightBurst(spec).x0).toEqual(lightBurst(spec).x0);
  });
});

describe("endsWithImpact", () => {
  it("飛翔の終わりと着弾の止まりの終わりが、足す順だけ違う同じ時刻なら、最後の着弾とみなす", () => {
    // 2 発目のマルチ弾（180 ms 遅れ）が 1 点目で着弾し、そこで弾道が終わる。浮動小数点では左辺が 5e-14 ほど大きくなる
    const launch = 180, flightEnd = launch + impactTimeMs(1, [1, 1]), impactAt = launch + impactTimeMs(0, [1]);
    expect(flightEnd > impactAt + HOLD_MS).toBe(true);
    expect(endsWithImpact(flightEnd, impactAt)).toBe(true);
  });
  it("着弾の後も弾が飛んでいれば、最後の着弾とみなさない", () => {
    expect(endsWithImpact(300, 196)).toBe(false);
  });
});

describe("hitstopClock", () => {
  it("止め始めから HITSTOP_MS の間は止まり、その後は HITSTOP_MS 遅れて進む", () => {
    expect(hitstopClock(100, null)).toBe(100);
    expect(hitstopClock(990, 1000)).toBe(990);
    expect(hitstopClock(1000 + HITSTOP_MS / 2, 1000)).toBe(1000);
    expect(hitstopClock(1500, 1000)).toBe(1500 - HITSTOP_MS);
  });
});

type Presentation = ReturnType<typeof presentLabReplay>;
const effect = (key: string, clock: number, over: Partial<LabEffect> = {}): LabEffect => ({ key, cx: 20, cy: 15, radius: 6, clock, damage: 0, damages: [], kills: [], final: false, ...over });
const presentation = (effects: readonly LabEffect[]): Presentation => ({ teleport: null, launches: [], players: [], terrainOps: [], bullets: [], trails: [], effects, hpBars: {}, misses: [], fallingIds: [], recoil: 0, shotFlashes: [] }) as Presentation;
const api = () => ({ impact: vi.fn(), killFlash: vi.fn(), freeze: vi.fn(), launch: vi.fn(), wreck: vi.fn(), teleport: vi.fn() });

describe("createLabImpactFx", () => {
  const replay = { startsAt: 1000, terrainOpsBefore: 2 };
  it("テレポートは弾が着地点に当たってから 1 回だけ光の柱を出し、動きを減らす設定では出さない（設計書 42.3）", () => {
    const tp = (age: number): Presentation => ({ ...presentation([]), teleport: { playerId: "p1", age, pose: teleportPoseAt(age), from: { x: 20, y: 150 }, to: { x: 200, y: 170 }, hit: { x: 200, y: 165 } } });
    const fx = createLabImpactFx(), effects = api();
    fx.update(effects, tp(-10), replay, "m", false);
    expect(effects.teleport).not.toHaveBeenCalled();
    fx.update(effects, tp(16), replay, "m", false);
    fx.update(effects, tp(40), replay, "m", false);
    expect(effects.teleport).toHaveBeenCalledTimes(1);
    expect(effects.teleport.mock.calls[0]![0]).toMatchObject({ age: 16, from: { x: 20, y: 150 }, to: { x: 200, y: 170 }, hit: { x: 200, y: 165 } });
    const reduced = createLabImpactFx(), other = api();
    reduced.update(other, tp(16), replay, "m", true);
    expect(other.teleport).not.toHaveBeenCalled();
  });
  it("着弾ごとに 1 回だけ、爆風が広がり始める時刻に生まれたものとして出す", () => {
    const fx = createLabImpactFx(), effects = api();
    fx.update(effects, presentation([effect("0", 30)]), replay, "m", false);
    fx.update(effects, presentation([effect("0", 50)]), replay, "m", false);
    expect(effects.impact).toHaveBeenCalledTimes(1);
    expect(effects.impact.mock.calls[0]![0].age).toBe(30 - HOLD_MS);
  });
  it("撃破した着弾では HP バーが減りきる時刻に全画面の光を出し、途中参加で昔の撃破は光らせない", () => {
    const fx = createLabImpactFx(), effects = api();
    fx.update(effects, presentation([effect("0", 0, { kills: ["p1"] })]), replay, "m", false);
    expect(effects.killFlash).toHaveBeenCalledTimes(1);
    const late = createLabImpactFx(), other = api();
    late.update(other, presentation([effect("0", 1000, { kills: ["p1"] })]), replay, "m", false);
    expect(other.killFlash).not.toHaveBeenCalled();
  });
  it("最後の着弾では削る瞬間に粒の時計を止める。新しい再生では数え直す", () => {
    const fx = createLabImpactFx(), effects = api();
    fx.update(effects, presentation([effect("0", CARVE_AT_MS - 1, { final: true })]), replay, "m", false);
    expect(effects.freeze).not.toHaveBeenCalled();
    fx.update(effects, presentation([effect("0", CARVE_AT_MS, { final: true })]), replay, "m", false);
    expect(effects.freeze).toHaveBeenCalledWith(HITSTOP_MS);
    fx.update(effects, presentation([effect("0", 0)]), { ...replay, startsAt: 5000 }, "m", false);
    expect(effects.impact).toHaveBeenCalledTimes(2);
  });
  it("動きを減らす設定では出さない", () => {
    const fx = createLabImpactFx(), effects = api();
    fx.update(effects, presentation([effect("0", 10, { final: true, kills: ["p1"] })]), replay, "m", true);
    expect(effects.impact).not.toHaveBeenCalled();
  });
});
