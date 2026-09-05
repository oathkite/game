import type { ShotResult } from "@game/protocol";
import { BLAST_RADIUS } from "@game/sim";
import { describe, expect, it } from "vitest";
import {
  BLAST_MIN_RADIUS,
  blastFrameAt,
  CARVE_AT_MS,
  damageSounds,
  damageTier,
  FLASH_MS_BY_TIER,
  flashMsOf,
  HOLD_MS,
  HP_DRAIN_MS,
  hpBarAt,
  IMPACT_TOTAL_MS,
  SHAKE_MS,
  shakeOffsetAt,
} from "@/game/hitFeedback";

// 着弾の手応えの時間の流れを数値で固定する。設計書 03 の 3.9 と 08 の 8.6

const shotOf = (seat: 0 | 1, damage: readonly [number, number], hpAfter: readonly [number, number]): ShotResult =>
  ({
    input: { seat, x: 100, facing: 1, elevation: 45, power: 50 },
    impact: { x: 200, y: 100 },
    terrainOp: { cx: 200, cy: 100, radius: BLAST_RADIUS },
    damage,
    hpAfter,
    xAfter: [100, 300],
    ringOut: [],
    finished: null,
  }) as unknown as ShotResult;

describe("blastFrameAt", () => {
  it("着弾の直後は弾を止め、爆風を描かない", () => {
    expect(blastFrameAt(0)).toEqual({ hold: true, radius: 0, ring: false, on: false, carved: false });
    expect(blastFrameAt(HOLD_MS - 1)?.hold).toBe(true);
  });

  it("爆風は最小半径から最大半径へ広がり、広がり切るまで地形を削らない", () => {
    expect(blastFrameAt(HOLD_MS)).toMatchObject({ hold: false, radius: BLAST_MIN_RADIUS, on: true, carved: false });
    expect(blastFrameAt(CARVE_AT_MS - 1)).toMatchObject({ carved: false });
    expect(blastFrameAt(CARVE_AT_MS)).toMatchObject({ radius: BLAST_RADIUS, carved: true, ring: false, on: true });
    const radii = [];
    for (let t = HOLD_MS; t < CARVE_AT_MS; t++) radii.push(blastFrameAt(t)?.radius ?? -1);
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeGreaterThanOrEqual(radii[i - 1] ?? 0);
  });

  it("最大半径で明滅し、最後は輪だけを残して消える", () => {
    expect(blastFrameAt(CARVE_AT_MS + 80)?.on).toBe(false);
    expect(blastFrameAt(CARVE_AT_MS + 160)?.on).toBe(true);
    expect(blastFrameAt(IMPACT_TOTAL_MS - 1)).toMatchObject({ ring: true, on: true, radius: BLAST_RADIUS });
    expect(blastFrameAt(IMPACT_TOTAL_MS)).toBeNull();
  });

  it("着弾の演出は 1 秒に収まる", () => {
    expect(IMPACT_TOTAL_MS).toBeLessThanOrEqual(1000);
  });
});

describe("damageTier と flashMsOf", () => {
  it("設計書 01 の最小 5 から最大 35 を 3 段階に分け、直撃ほど長く白くする", () => {
    expect(damageTier(0)).toBe(0);
    expect(damageTier(5)).toBe(1);
    expect(damageTier(14)).toBe(1);
    expect(damageTier(15)).toBe(2);
    expect(damageTier(24)).toBe(2);
    expect(damageTier(25)).toBe(3);
    expect(damageTier(35)).toBe(3);
    expect(flashMsOf(0)).toBe(0);
    expect(flashMsOf(5)).toBeLessThan(flashMsOf(20));
    expect(flashMsOf(20)).toBeLessThan(flashMsOf(35));
  });

  it("白い長さは爆風が消えるまでに収まる。落下の段階では白を描かないため", () => {
    for (const ms of Object.values(FLASH_MS_BY_TIER)) expect(ms).toBeLessThanOrEqual(IMPACT_TOTAL_MS - CARVE_AT_MS);
  });
});

describe("damageSounds", () => {
  it("観戦者には被弾も手応えも鳴らない", () => {
    expect(damageSounds(shotOf(0, [0, 20], [100, 80]), null)).toEqual([]);
  });

  it("自分の弾が相手に入ると手応えの音が鳴る", () => {
    expect(damageSounds(shotOf(0, [0, 20], [100, 80]), 0)).toEqual(["hitConfirm"]);
  });

  it("被弾した側には警告音が鳴り、手応えの音は鳴らない", () => {
    expect(damageSounds(shotOf(0, [0, 20], [100, 80]), 1)).toEqual(["hit"]);
  });

  it("自爆を巻き込んだ命中では警告音と手応えの音が両方鳴る", () => {
    expect(damageSounds(shotOf(0, [5, 20], [95, 80]), 0)).toEqual(["hit", "hitConfirm"]);
  });

  it("外れでは何も鳴らない", () => {
    expect(damageSounds(shotOf(0, [0, 0], [100, 100]), 0)).toEqual([]);
  });

  it("この一撃で HP が尽きたときは決着音を最後に足し、観戦者にも鳴る", () => {
    expect(damageSounds(shotOf(0, [0, 35], [100, 0]), 0)).toEqual(["hitConfirm", "finish"]);
    expect(damageSounds(shotOf(0, [0, 35], [100, 0]), null)).toEqual(["finish"]);
    expect(damageSounds(shotOf(0, [0, 35], [100, 5]), 0)).toEqual(["hitConfirm"]);
    // すでに 0 の相手に当てていない場合は鳴らさない
    expect(damageSounds(shotOf(0, [0, 0], [100, 0]), 0)).toEqual([]);
  });
});

describe("shakeOffsetAt", () => {
  it("無傷の着弾では揺れない", () => {
    expect(shakeOffsetAt(0, [0, 0])).toEqual({ dx: 0, dy: 0 });
  });

  it("直撃は大きく揺れ、時間とともに小さくなり、終わりで止まる", () => {
    const first = shakeOffsetAt(0, [0, 35]);
    expect(Math.max(Math.abs(first.dx), Math.abs(first.dy))).toBe(3);
    const late = shakeOffsetAt(SHAKE_MS - 1, [0, 35]);
    expect(Math.max(Math.abs(late.dx), Math.abs(late.dy))).toBe(1);
    expect(shakeOffsetAt(SHAKE_MS, [0, 35])).toEqual({ dx: 0, dy: 0 });
  });

  it("かすりは 1 セルだけ揺れ、ずらし量は常に整数セル", () => {
    for (let t = 0; t < SHAKE_MS; t += 7) {
      const o = shakeOffsetAt(t, [5, 0]);
      expect(Number.isInteger(o.dx) && Number.isInteger(o.dy)).toBe(true);
      expect(Math.max(Math.abs(o.dx), Math.abs(o.dy))).toBeLessThanOrEqual(1);
    }
  });

  it("両方に当たったときは大きい方のダメージで揺れる", () => {
    expect(shakeOffsetAt(0, [5, 30])).toEqual(shakeOffsetAt(0, [0, 30]));
  });

  it("揺れは爆風が消えるまでに収まる", () => {
    expect(SHAKE_MS).toBeLessThanOrEqual(IMPACT_TOTAL_MS - CARVE_AT_MS);
  });
});

describe("hpBarAt", () => {
  it("減る前の値から後の値へ一定の速さで減り、減り切るのは爆風が消える時点", () => {
    expect(hpBarAt(0, 100, 65).hp).toBe(100);
    expect(hpBarAt(HP_DRAIN_MS / 2, 100, 65).hp).toBe(83);
    expect(hpBarAt(HP_DRAIN_MS, 100, 65).hp).toBe(65);
    expect(hpBarAt(HP_DRAIN_MS * 2, 100, 65).hp).toBe(65);
    expect(HP_DRAIN_MS).toBe(IMPACT_TOTAL_MS - CARVE_AT_MS);
  });

  it("失った区間は減る前の値を保ち、爆風と同じ周期で明滅する", () => {
    expect(hpBarAt(0, 100, 65)).toMatchObject({ hpGhost: 100, ghostOn: true });
    expect(hpBarAt(80, 100, 65).ghostOn).toBe(false);
    expect(hpBarAt(160, 100, 65).ghostOn).toBe(true);
  });

  it("0 を下回る HP でも塗る値は後の値で止まる", () => {
    expect(hpBarAt(HP_DRAIN_MS, 10, -25).hp).toBe(-25);
  });
});
