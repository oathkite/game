import { describe, expect, it } from "vitest";
import { computeLayout, DPAD_GAP, PANEL_MIN, TOUCH_MIN } from "@/game/scale";
import { powerFromElapsed } from "@/ui/powerGauge";
import { stepMarkWidth } from "@/ui/stepMeter";

describe("computeLayout", () => {
  it("パネルは指の届く幅を先に取り、マップは残りに収まる限り大きく描く", () => {
    const l = computeLayout(1792, 900);
    expect(l.panelWidth).toBe(PANEL_MIN);
    expect(l.mapWidth).toBe(1792 - PANEL_MIN * 2);
    expect(l.mapHeight).toBeLessThanOrEqual(900);
    // 縦横比は保つ
    expect(l.mapWidth / l.mapHeight).toBeCloseTo(400 / 225, 1);
  });

  it("縦横比を保ち、画面に収まる大きさへ連続的に縮める", () => {
    const l = computeLayout(1400, 800);
    expect(l.mapWidth).toBeLessThanOrEqual(1400 - l.panelWidth * 2);
    expect(l.mapHeight).toBeLessThanOrEqual(800);
    // 整数倍に丸めないので、幅と高さのどちらかは画面いっぱいまで使う
    const tight = Math.min(1400 - l.panelWidth * 2 - l.mapWidth, 800 - l.mapHeight);
    expect(tight).toBeLessThan(1);
  });

  it("iPhone 15 Pro Max の横向き（932 × 430）でも指が届くパネルを確保する", () => {
    const l = computeLayout(932, 430);
    expect(l.panelWidth).toBeGreaterThanOrEqual(PANEL_MIN);
    // 十字キーの 1 ボタンがタップできる大きさになる
    expect(Math.floor((l.panelWidth - 8 - DPAD_GAP * 2) / 3)).toBeGreaterThanOrEqual(TOUCH_MIN);
    // マップは残りの幅に収まる
    expect(l.mapWidth).toBeLessThanOrEqual(932 - l.panelWidth * 2);
    expect(l.mapHeight).toBeLessThanOrEqual(430);
  });

  it("パネルは画面の幅の 4 分の 1 を超えて奪わない", () => {
    for (const [w, h] of [[932, 430], [320, 200], [1792, 900], [2560, 1440]] as const) {
      const l = computeLayout(w, h);
      expect(l.panelWidth * 2).toBeLessThanOrEqual(w / 2);
      expect(l.mapWidth).toBeGreaterThan(0);
      expect(l.mapHeight).toBeGreaterThan(0);
    }
  });

  it("小さすぎる画面でもマップが消えない", () => {
    const l = computeLayout(320, 200);
    expect(l.cell).toBeGreaterThan(0);
    expect(l.mapWidth).toBeGreaterThan(0);
  });
});

describe("stepMarkWidth", () => {
  it("目盛りはパネルの内側に収まる", () => {
    for (const width of [96, 132, 200]) {
      for (const steps of [15, 30]) {
        const mark = stepMarkWidth(width, steps);
        expect(mark * steps + (steps - 1)).toBeLessThanOrEqual(width - 8);
      }
    }
  });

  it("目盛りは 1 px を下回らない", () => {
    expect(stepMarkWidth(20, 30)).toBe(1);
  });

  it("歩数が 0 なら 0 にする", () => {
    expect(stepMarkWidth(96, 0)).toBe(0);
  });
});

describe("powerFromElapsed", () => {
  it("1.5 秒で 100 に達し、それ以上は 100 で止まる", () => {
    expect(powerFromElapsed(0)).toBe(0);
    expect(powerFromElapsed(750)).toBe(50);
    expect(powerFromElapsed(1500)).toBe(100);
    expect(powerFromElapsed(5000)).toBe(100);
  });

  it("負の経過時間は 0 にする", () => {
    expect(powerFromElapsed(-10)).toBe(0);
  });
});
