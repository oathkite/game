import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WIND_MAX } from "@game/sim";
import { BattleConsole, BattleOverlay } from "../src/worldUi/BattleHud";
import { WindGauge } from "../src/worldUi/WindGauge";
import { WIND_METER_HALF, WIND_METER_HEIGHT, WIND_METER_PITCH, mirrorRects, windArrowRects, windStrength, windTicks } from "../src/worldUi/windMeterPixels";

// 風のメーター（設計書 08 の 8.5）。中央から風の側へ、強さに比例した矢印を伸ばし、数値を添える。操作盤の中で角度メーターの真下に置く。

const columns = (rects: ReturnType<typeof windArrowRects>) => new Map(rects.flatMap(r => Array.from({ length: r.width }, (_, i) => [r.left + i, r] as const)));

describe("windStrength", () => {
  it.each([[0, 0], [1, 1], [-1, 1], [7, 7], [-7, 7], [WIND_MAX, WIND_MAX], [-WIND_MAX, WIND_MAX], [13, WIND_MAX], [-13, WIND_MAX]])("wind %s shows %s", (wind, strength) => {
    expect(windStrength(wind)).toBe(strength);
  });
});

describe("windArrowRects", () => {
  it("draws nothing without wind", () => {
    expect(windArrowRects(0)).toEqual([]);
  });
  it.each(Array.from({ length: WIND_MAX }, (_, i) => i + 1))("keeps strength %s on the art px grid and ends on its tick", strength => {
    const rects = windArrowRects(strength);
    for (const r of rects) {
      expect([r.left, r.top, r.width, r.height].every(Number.isInteger)).toBe(true);
      expect(r.left).toBeGreaterThanOrEqual(0); expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.left + r.width).toBeLessThanOrEqual(WIND_METER_HALF); expect(r.top + r.height).toBeLessThanOrEqual(WIND_METER_HEIGHT);
    }
    const filled = columns(rects);
    const tip = Math.max(...filled.keys());
    expect(tip).toBe(windTicks()[strength - 1]!.left);
    expect(filled.get(tip)).toMatchObject({ top: 3, height: 1 });
    expect([...filled.keys()].sort((a, b) => a - b)).toEqual(Array.from({ length: strength * WIND_METER_PITCH }, (_, x) => x));
  });
  it("grows one pitch per strength and keeps a full-height head once it fits", () => {
    for (let strength = 2; strength <= WIND_MAX; strength++) {
      expect(columns(windArrowRects(strength)).size - columns(windArrowRects(strength - 1)).size).toBe(WIND_METER_PITCH);
      expect(Math.max(...windArrowRects(strength).map(r => r.height))).toBe(WIND_METER_HEIGHT);
    }
  });
});

describe("windTicks", () => {
  it("marks every strength and lengthens 5 and 10", () => {
    const ticks = windTicks();
    expect(ticks).toHaveLength(WIND_MAX);
    expect(ticks.map(t => t.left)).toEqual(Array.from({ length: WIND_MAX }, (_, i) => (i + 1) * WIND_METER_PITCH - 1));
    expect(ticks.filter(t => t.major).map(t => ticks.indexOf(t) + 1)).toEqual([5, 10]);
    expect(ticks.every(t => t.top + t.height <= WIND_METER_HEIGHT)).toBe(true);
  });
});

describe("mirrorRects", () => {
  it.each(Array.from({ length: WIND_MAX }, (_, i) => i + 1))("draws the left arrow of strength %s from the center out to the left", strength => {
    const filled = columns(mirrorRects(windArrowRects(strength)));
    const xs = [...filled.keys()].sort((a, b) => a - b);
    expect(xs).toEqual(Array.from({ length: strength * WIND_METER_PITCH }, (_, i) => WIND_METER_HALF - strength * WIND_METER_PITCH + i));
    expect(filled.get(xs[0]!)).toMatchObject({ top: 3, height: 1 });
  });
  it("keeps the vertical position and size of every rect", () => {
    const ticks = windTicks();
    expect(mirrorRects(ticks).map(({ top, width, height, major }) => ({ top, width, height, major }))).toEqual(ticks.map(({ top, width, height, major }) => ({ top, width, height, major })));
  });
});

describe("WindGauge", () => {
  const halves = (html: string) => [...html.matchAll(/<svg[^>]*data-side="(-?1)"[^>]*>(.*?)<\/svg>/g)].map(m => ({ side: m[1], body: m[2]! }));
  it("points right with the strength for positive wind", () => {
    const html = renderToStaticMarkup(createElement(WindGauge, { wind: 6 }));
    expect(html).toContain('<span class="battle-sr">右向きの風 6</span>');
    expect(html).toContain('data-direction="1"');
    expect(html).toContain('data-strength="6"');
    expect(html).toContain('<b aria-hidden="true">6</b>');
    const [left, right] = halves(html);
    expect(left).toMatchObject({ side: "-1" }); expect(left!.body).not.toContain("battle-wind-arrow");
    expect(right).toMatchObject({ side: "1" }); expect(right!.body).toContain("battle-wind-arrow");
  });
  it("draws the arrow in the left half for negative wind", () => {
    const html = renderToStaticMarkup(createElement(WindGauge, { wind: -7 }));
    expect(html).toContain('<span class="battle-sr">左向きの風 7</span>');
    expect(html).toContain('data-direction="-1"');
    expect(html).toContain('<b aria-hidden="true">7</b>');
    const [left, right] = halves(html);
    expect(left!.body).toContain("battle-wind-arrow");
    expect(right!.body).not.toContain("battle-wind-arrow");
  });
  it("shows only the scale when there is no wind", () => {
    const html = renderToStaticMarkup(createElement(WindGauge, { wind: 0 }));
    expect(html).toContain('<span class="battle-sr">無風</span>');
    expect(html).toContain('data-direction="0"');
    expect(html).toContain('<b aria-hidden="true">0</b>');
    expect(html).not.toContain("battle-wind-arrow");
    for (const half of halves(html)) expect(half.body).toContain("battle-wind-tick");
  });
  it("announces the wind once, through a polite live region", () => {
    const html = renderToStaticMarkup(createElement(WindGauge, { wind: 6 }));
    expect(html).toMatch(/^<div class="battle-wind" aria-live="polite" aria-atomic="true"/);
    expect(html).not.toContain("role=");
    expect(html).not.toContain("aria-label");
    expect(html.match(/右向きの風 6/g)).toHaveLength(1);
  });
  it("shows a dash and no arrow before the wind is decided", () => {
    const html = renderToStaticMarkup(createElement(WindGauge, { wind: null }));
    expect(html).toContain('<span class="battle-sr">風は未定</span>');
    expect(html).toContain('<b aria-hidden="true">—</b>');
    expect(html).not.toContain("battle-wind-arrow");
    expect(html).not.toContain("data-direction");
  });
  it("keeps the received value in the number while the arrow stops at the end", () => {
    const html = renderToStaticMarkup(createElement(WindGauge, { wind: -13 }));
    expect(html).toContain('<span class="battle-sr">左向きの風 13</span>');
    expect(html).toContain(`data-strength="${WIND_MAX}"`);
    expect(html).toContain('<b aria-hidden="true">13</b>');
  });
});

describe("BattleConsole", () => {
  const props = { steps: 30, tilt: 0, elevation: 45, facing: 1 as const, power: 0, slot: 0, disabled: false, selectSlot: () => undefined };
  it("lays the console out in two rows and puts the wind meter right after the angle dial", () => {
    const html = renderToStaticMarkup(createElement(BattleConsole, { ...props, wind: -4 }));
    expect(html).toMatch(/^<footer class="battle-console has-wind">/);
    expect(html).toMatch(/<svg class="battle-angle"[^>]*>.*?<\/svg><div class="battle-wind"[^>]*>.*?<span class="battle-sr">左向きの風 4<\/span>/);
  });
  it("places the power ruler and the movement reserve straight in the two-row grid", () => {
    const html = renderToStaticMarkup(createElement(BattleConsole, { ...props, wind: 3 }));
    expect(html).not.toContain("battle-gauges");
    expect(html).toContain('class="battle-power"');
    expect(html).toContain('class="battle-movement"');
  });
  it("keeps the two-row layout with a dash while the wind is not decided", () => {
    const html = renderToStaticMarkup(createElement(BattleConsole, { ...props, wind: null }));
    expect(html).toMatch(/^<footer class="battle-console has-wind">/);
    expect(html).toContain('<span class="battle-sr">風は未定</span>');
  });
  it("keeps the single-row layout without a wind meter when no wind is given", () => {
    const html = renderToStaticMarkup(createElement(BattleConsole, props));
    expect(html).toMatch(/^<footer class="battle-console">/);
    expect(html).toContain('<div class="battle-gauges"><div class="battle-power"');
    expect(html).not.toContain("battle-wind");
  });
  it("adds the touch class next to the wind class", () => {
    const html = renderToStaticMarkup(createElement(BattleConsole, { ...props, wind: 2, children: createElement("span") }));
    expect(html).toMatch(/^<footer class="battle-console has-touch has-wind">/);
  });
});

describe("BattleOverlay", () => {
  it("does not carry the wind meter", () => {
    const html = renderToStaticMarkup(createElement(BattleOverlay, { clock: createElement("span", null, "11"), onMenu: () => undefined }));
    expect(html).not.toContain("battle-wind");
  });
});
