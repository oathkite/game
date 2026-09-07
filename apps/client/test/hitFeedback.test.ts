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
  DEBRIS_APEX_MS,
  DEBRIS_MS,
  debrisAt,
  debrisCount,
  HOLD_MS,
  HP_DRAIN_MS,
  FAN_DELAY_MS,
  impactTimeMs,
  launchDelayMs,
  projectileFrameAt,
  STEP_MS,
  VOLLEY_DELAY_MS,
  MISS_MS,
  missMarkAt,
  hpBarAt,
  IMPACT_TOTAL_MS,
  SHAKE_MS,
  shakeOffsetAt,
} from "@/game/hitFeedback";

// 着弾の手応えの時間の流れを数値で固定する。設計書 03 の 3.9 と 08 の 8.6

/** 着弾 1 つぶんの音の入力。撃った席、その着弾のダメージ、着弾後の HP。着弾前の HP は後の値にダメージを足し戻す */
const sounds = (seat: 0 | 1, damage: readonly [number, number], hpAfter: readonly [number, number], mySeat: 0 | 1 | null) =>
  damageSounds(damage, [hpAfter[0] + damage[0], hpAfter[1] + damage[1]], hpAfter, seat, mySeat);

describe("blastFrameAt", () => {
  it("武器の爆風半径を渡すと、その半径まで広がって止まる", () => {
    expect(blastFrameAt(CARVE_AT_MS, 16)).toMatchObject({ radius: 16, carved: true });
    expect(blastFrameAt(CARVE_AT_MS, 3)).toMatchObject({ radius: 3, carved: true });
    expect(blastFrameAt(HOLD_MS, 16)).toMatchObject({ radius: BLAST_MIN_RADIUS });
  });

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
    expect(sounds(0, [0, 20], [100, 80], null)).toEqual([]);
  });

  it("自分の弾が相手に入ると手応えの音が鳴る", () => {
    expect(sounds(0, [0, 20], [100, 80], 0)).toEqual(["hitConfirm"]);
  });

  it("被弾した側には警告音が鳴り、手応えの音は鳴らない", () => {
    expect(sounds(0, [0, 20], [100, 80], 1)).toEqual(["hit"]);
  });

  it("自爆を巻き込んだ命中では警告音と手応えの音が両方鳴る", () => {
    expect(sounds(0, [5, 20], [95, 80], 0)).toEqual(["hit", "hitConfirm"]);
  });

  it("外れでは何も鳴らない", () => {
    expect(sounds(0, [0, 0], [100, 100], 0)).toEqual([]);
  });

  it("この一撃で HP が尽きたときは決着音を最後に足し、観戦者にも鳴る", () => {
    expect(sounds(0, [0, 35], [100, 0], 0)).toEqual(["hitConfirm", "finish"]);
    expect(sounds(0, [0, 35], [100, 0], null)).toEqual(["finish"]);
    expect(sounds(0, [0, 35], [100, 5], 0)).toEqual(["hitConfirm"]);
    // すでに 0 の相手に当てていない場合は鳴らさない
    expect(sounds(0, [0, 0], [100, 0], 0)).toEqual([]);
    // すでに沈んだ機体に続きの段が入っても、決着音は繰り返さない（貫通弾の食い込み）
    expect(damageSounds([0, 8], [100, -6], [100, -14], 0, 0)).toEqual(["hitConfirm"]);
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

describe("debrisAt", () => {
  const impact = { x: 200, y: 100 };

  it("削れた瞬間は爆心から出て、上へ飛んでから落ち、爆風が消えるまでに消える", () => {
    const start = debrisAt(0, impact);
    expect(start.length).toBe(8);
    for (const c of start) expect(c).toEqual(impact);
    const apex = debrisAt(DEBRIS_APEX_MS, impact);
    const apexMinY = Math.min(...apex.map((c) => c.y));
    expect(impact.y - apexMinY).toBeGreaterThanOrEqual(9);
    const late = debrisAt(DEBRIS_MS - 1, impact);
    const lateMinY = Math.min(...late.map((c) => c.y));
    expect(lateMinY).toBeGreaterThan(apexMinY);
    expect(debrisAt(DEBRIS_MS, impact)).toEqual([]);
    expect(DEBRIS_MS).toBeLessThanOrEqual(IMPACT_TOTAL_MS - CARVE_AT_MS);
  });

  it("位置は整数セルで、左右に散る", () => {
    const cells = debrisAt(200, impact);
    for (const c of cells) expect(Number.isInteger(c.x) && Number.isInteger(c.y)).toBe(true);
    expect(cells.some((c) => c.x < impact.x)).toBe(true);
    expect(cells.some((c) => c.x > impact.x)).toBe(true);
  });
});

describe("missMarkAt", () => {
  it("弾が消えた位置をマップの内側に寄せ、明滅しながら短く出る", () => {
    expect(missMarkAt(0, { x: 420, y: -5 })).toEqual({ x: 398, y: 1, on: true });
    expect(missMarkAt(50, { x: -3, y: 300 })).toEqual({ x: 1, y: 223, on: false });
    expect(missMarkAt(MISS_MS, { x: 10, y: 10 })).toBeNull();
    expect(MISS_MS).toBeLessThan(IMPACT_TOTAL_MS);
  });
});

describe("複数の弾道と多段の着弾の時間", () => {
  it("扇の弾は FAN_DELAY_MS ずつ順に、次の発は VOLLEY_DELAY_MS 遅れて発射し、発は重ならない", () => {
    expect([0, 1, 2].map((p) => launchDelayMs(p, 3))).toEqual([0, FAN_DELAY_MS, FAN_DELAY_MS * 2]);
    expect([3, 4, 5].map((p) => launchDelayMs(p, 3))).toEqual([VOLLEY_DELAY_MS, VOLLEY_DELAY_MS + FAN_DELAY_MS, VOLLEY_DELAY_MS + FAN_DELAY_MS * 2]);
    expect(launchDelayMs(8, 3)).toBe(VOLLEY_DELAY_MS * 2 + FAN_DELAY_MS * 2);
    expect(VOLLEY_DELAY_MS).toBeGreaterThan(FAN_DELAY_MS * 3);
    expect(launchDelayMs(0, 1)).toBe(0);
  });

  it("k 段目の着弾の時刻は、その添字のステップ時間に前の段の静止ぶんを足したもの", () => {
    expect(impactTimeMs(0, [30, 40, 45])).toBe(30 * STEP_MS);
    expect(impactTimeMs(1, [30, 40, 45])).toBe(40 * STEP_MS + HOLD_MS);
    expect(impactTimeMs(2, [30, 40, 45])).toBe(45 * STEP_MS + 2 * HOLD_MS);
  });

  it("弾は 1 ステップを STEP_MS で進み、着弾で HOLD_MS 止まってから続きを飛ぶ", () => {
    const at = [30, 40];
    expect(projectileFrameAt(0, at, 50)).toMatchObject({ index: 0, holding: false, ended: false });
    expect(projectileFrameAt(15 * STEP_MS, at, 50).index).toBeCloseTo(15);
    expect(projectileFrameAt(30 * STEP_MS, at, 50)).toMatchObject({ index: 30, holding: true });
    expect(projectileFrameAt(30 * STEP_MS + HOLD_MS - 1, at, 50)).toMatchObject({ index: 30, holding: true });
    // 浮動小数点の誤差を避けて 1 ミリ秒だけ後を見る
    expect(projectileFrameAt(30 * STEP_MS + HOLD_MS + 1, at, 50)).toMatchObject({ holding: false });
    expect(projectileFrameAt(35 * STEP_MS + HOLD_MS, at, 50).index).toBeCloseTo(35, 3);
    expect(projectileFrameAt(40 * STEP_MS + HOLD_MS + 1, at, 50)).toMatchObject({ index: 40, holding: true });
    expect(projectileFrameAt(49 * STEP_MS + 2 * HOLD_MS + 1, at, 50)).toMatchObject({ index: 49, ended: true });
  });

  it("着弾の無い弾道は位置列の終わりで ended になり、添字は終わりで止まる", () => {
    const f = projectileFrameAt(1000 * STEP_MS, [], 20);
    expect(f.ended).toBe(true);
    expect(f.index).toBe(19);
  });
});

describe("debrisCount", () => {
  it("爆風が広いほど破片は多く、狭い爆風は 2 個。左右対称を保つため偶数", () => {
    expect(debrisCount(BLAST_RADIUS)).toBe(8);
    expect(debrisCount(16)).toBe(8);
    expect(debrisCount(6)).toBe(6);
    expect(debrisCount(3)).toBe(4);
    expect(debrisCount(2)).toBe(2);
    for (const r of [2, 3, 6, 8, 10, 16]) expect(debrisCount(r) % 2).toBe(0);
    expect(debrisAt(100, { x: 100, y: 100 }, 2)).toHaveLength(2);
    expect(debrisAt(100, { x: 100, y: 100 })).toHaveLength(8);
  });
});
