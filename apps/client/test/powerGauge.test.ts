import { describe, expect, it } from "vitest";
import { IDLE_GAUGE, POWER_FULL_MS, powerFromElapsed, stepGauge } from "@/ui/powerGauge";

// パワーゲージの状態遷移。押している時間でパワーが決まり、1.5 秒で自動発射する（設計書 03 の 3.5）。

const begun = (source: "pointer" | "key" = "pointer") => stepGauge(IDLE_GAUGE, { type: "begin", source, now: 1000 }).state;

describe("powerFromElapsed", () => {
  it("0 ミリ秒で 0、1.5 秒で 100、それ以上は 100 で止まる", () => {
    expect(powerFromElapsed(0)).toBe(0);
    expect(powerFromElapsed(750)).toBe(50);
    expect(powerFromElapsed(1499)).toBe(99);
    expect(powerFromElapsed(POWER_FULL_MS)).toBe(100);
    expect(powerFromElapsed(5000)).toBe(100);
    expect(powerFromElapsed(-10)).toBe(0);
  });
});

describe("stepGauge", () => {
  it("押し始めると 0 から溜まり、tick で値が進む", () => {
    const s = begun();
    expect(s.value).toBe(0);
    const r = stepGauge(s, { type: "tick", now: 1600, enabled: true });
    expect(r.fire).toBeNull();
    expect(r.state.value).toBe(40);
    expect(r.state.startedAt).toBe(1000);
  });

  it("離した瞬間のパワーで発射し、値を固定表示する", () => {
    const r = stepGauge(begun(), { type: "release", source: "pointer", now: 1750 });
    expect(r.fire).toBe(50);
    expect(r.state.startedAt).toBeNull();
    expect(r.state.value).toBe(50);
  });

  it("1.5 秒に達した tick で 100 を自動発射する", () => {
    const before = stepGauge(begun(), { type: "tick", now: 1000 + POWER_FULL_MS - 1, enabled: true });
    expect(before.fire).toBeNull();
    const r = stepGauge(before.state, { type: "tick", now: 1000 + POWER_FULL_MS, enabled: true });
    expect(r.fire).toBe(100);
    expect(r.state.value).toBe(100);
    expect(r.state.startedAt).toBeNull();
  });

  it("自動発射した後の release は何もしない", () => {
    const fired = stepGauge(begun(), { type: "tick", now: 1000 + POWER_FULL_MS, enabled: true }).state;
    const r = stepGauge(fired, { type: "release", source: "pointer", now: 3000 });
    expect(r.fire).toBeNull();
    expect(r.state).toEqual(fired);
  });

  it("別の入力元の release は無視し、先に始まった方だけが有効", () => {
    const s = begun("key");
    const ignored = stepGauge(s, { type: "release", source: "pointer", now: 1500 });
    expect(ignored.fire).toBeNull();
    expect(ignored.state).toEqual(s);
    const second = stepGauge(s, { type: "begin", source: "pointer", now: 1200 });
    expect(second.state).toEqual(s);
  });

  it("cancel は溜めていたパワーを捨てて発射しない", () => {
    const r = stepGauge(begun(), { type: "cancel" });
    expect(r.fire).toBeNull();
    expect(r.state).toEqual(IDLE_GAUGE);
  });

  it("押していないときの tick と release は何もしない", () => {
    expect(stepGauge(IDLE_GAUGE, { type: "tick", now: 5, enabled: true }).state).toEqual(IDLE_GAUGE);
    expect(stepGauge(IDLE_GAUGE, { type: "release", source: "key", now: 5 }).fire).toBeNull();
  });

  it("溜めている間に操作が無効になったら、100 に達していても撃たずに捨てる", () => {
    const r = stepGauge(begun(), { type: "tick", now: 1000 + POWER_FULL_MS, enabled: false });
    expect(r.fire).toBeNull();
    expect(r.state).toEqual(IDLE_GAUGE);
  });
});
