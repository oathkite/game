import { describe, expect, it } from "vitest";
import {
  CHARGE_SHAKE_FROM,
  chargeAt,
  idleRumble,
  LAND_MS,
  LAND_SQUASH_MS,
  landingAt,
  RUMBLE_DOWN_MS,
  RUMBLE_PERIOD_MS,
  SMOKE_PERIOD_MS,
  SMOKE_PUFFS,
  smokeAt,
  smokeSparkOn,
  WRECK_AT_MS,
  WRECK_BLINK_MS,
  WRECK_MS,
  WRECK_SMOKE_FROM_MS,
  WRECK_SMOKE_UNTIL_MS,
  wreckFrameAt,
} from "@/game/tankMotion";

// 機体まわりの演出の時間の流れを数値で固定する。設計書 38

describe("idleRumble", () => {
  it("周期の頭だけ 1 art px 沈み、残りは戻っている", () => {
    expect(idleRumble(0, false)).toBe(1);
    expect(idleRumble(RUMBLE_DOWN_MS - 1, false)).toBe(1);
    expect(idleRumble(RUMBLE_DOWN_MS, false)).toBe(0);
    expect(idleRumble(RUMBLE_PERIOD_MS, false)).toBe(1);
  });
  it("動きを減らす設定と負の時刻では沈まない", () => {
    expect(idleRumble(0, true)).toBe(0);
    expect(idleRumble(-10, false)).toBe(0);
  });
});

describe("landingAt", () => {
  it("接地した直後だけ沈み、土煙は左右対称に 3 粒ずつ外へ広がる", () => {
    const start = landingAt(0, false)!;
    expect(start.squash).toBe(1);
    expect(start.dust).toHaveLength(6);
    const later = landingAt(300, false)!;
    expect(later.squash).toBe(0);
    for (let i = 0; i < 6; i += 2) {
      expect(later.dust[i]!.x).toBe(-later.dust[i + 1]!.x);
      expect(Math.abs(later.dust[i]!.x)).toBeGreaterThan(Math.abs(start.dust[i]!.x));
    }
    expect(landingAt(LAND_SQUASH_MS, false)!.squash).toBe(0);
  });
  it("長さを過ぎたら何も出さない。負の時刻も同じ", () => {
    expect(landingAt(LAND_MS, false)).toBeNull();
    expect(landingAt(-1, false)).toBeNull();
  });
  it("動きを減らす設定では沈み込みだけで土煙を出さない", () => {
    expect(landingAt(0, true)).toEqual({ squash: 1, dust: [] });
  });
});

describe("smokeAt", () => {
  it("粒は周期ごとに同じ位置へ戻り、上へ昇るほど薄くなる", () => {
    const a = smokeAt(100, false), b = smokeAt(100 + SMOKE_PERIOD_MS, false);
    expect(a).toEqual(b);
    expect(a).toHaveLength(SMOKE_PUFFS);
    const high = a.reduce((m, p) => (p.y < m.y ? p : m));
    const low = a.reduce((m, p) => (p.y > m.y ? p : m));
    expect(high.tone).toBeGreaterThanOrEqual(low.tone);
  });
  it("動きを減らす設定では止まった 1 粒だけ", () => {
    expect(smokeAt(0, true)).toHaveLength(1);
    expect(smokeAt(0, true)).toEqual(smokeAt(999, true));
  });
  it("火花は 1200 ms ごとに 80 ms だけ点き、動きを減らす設定では点かない", () => {
    expect(smokeSparkOn(0, false)).toBe(true);
    expect(smokeSparkOn(80, false)).toBe(false);
    expect(smokeSparkOn(1200, false)).toBe(true);
    expect(smokeSparkOn(0, true)).toBe(false);
  });
});

describe("wreckFrameAt", () => {
  it("明滅、時間差の 3 連爆発、残骸の順に進む", () => {
    expect(wreckFrameAt(0, false)).toMatchObject({ intact: true, white: true, bursts: [] });
    expect(wreckFrameAt(50, false).white).toBe(false);
    expect(wreckFrameAt(WRECK_BLINK_MS, false)).toMatchObject({ intact: true, white: false });
    expect(wreckFrameAt(WRECK_BLINK_MS, false).bursts).toHaveLength(1);
    expect(wreckFrameAt(410, false).bursts).toHaveLength(2);
    expect(wreckFrameAt(700, false).bursts).toHaveLength(1);
    expect(wreckFrameAt(WRECK_AT_MS, false).intact).toBe(false);
    expect(wreckFrameAt(WRECK_MS, false).bursts).toEqual([]);
  });
  it("爆発は広がってから輪になって消える", () => {
    const first = wreckFrameAt(WRECK_BLINK_MS + 10, false).bursts[0]!;
    const ring = wreckFrameAt(WRECK_BLINK_MS + 210, false).bursts[0]!;
    expect(first.radius).toBeLessThan(ring.radius);
    expect(ring.ring).toBe(true);
  });
  it("残骸の煙は決まった区間だけ出る", () => {
    expect(wreckFrameAt(WRECK_SMOKE_FROM_MS - 1, false).smoke).toBe(false);
    expect(wreckFrameAt(WRECK_SMOKE_FROM_MS + 200, false).smoke).toBe(true);
    expect(wreckFrameAt(WRECK_SMOKE_UNTIL_MS, false).smoke).toBe(false);
  });
  it("動きを減らす設定ではすぐ残骸になり、爆発も煙も出さない", () => {
    expect(wreckFrameAt(0, true)).toEqual({ intact: false, white: false, bursts: [], smoke: false });
    expect(wreckFrameAt(1000, true).smoke).toBe(false);
  });
});

describe("chargeAt", () => {
  it("溜めていなければ何も出さない", () => {
    expect(chargeAt(0, 0, false)).toBeNull();
  });
  it("パワーが大きいほど点が増え、上限近くで砲身が震える", () => {
    const low = chargeAt(0.1, 0, false)!, high = chargeAt(0.95, 0, false)!;
    expect(high.dots.length).toBeGreaterThan(low.dots.length);
    expect(low.shake).toBe(0);
    expect(high.hot).toBe(true);
    expect(chargeAt(CHARGE_SHAKE_FROM, 0, false)!.shake).not.toBe(0);
    expect(chargeAt(0.95, 0, false)!.shake).not.toBe(chargeAt(0.95, 60, false)!.shake);
  });
  it("点は砲口へ近づいていく", () => {
    const dist = (t: number) => Math.hypot(chargeAt(0.1, t, false)!.dots[0]!.x, chargeAt(0.1, t, false)!.dots[0]!.y);
    expect(dist(300)).toBeLessThan(dist(0));
  });
  it("動きを減らす設定では点を止め、砲身も震えない", () => {
    expect(chargeAt(0.95, 0, true)).toEqual(chargeAt(0.95, 500, true));
    expect(chargeAt(0.95, 0, true)!.shake).toBe(0);
  });
});
