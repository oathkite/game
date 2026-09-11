import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AngleDial, PowerRuler } from "../src/worldUi/BattleInstruments";

describe("battle instruments", () => {
  it("keeps 100 equal intervals with 11 major ticks and a precise current value", () => {
    const html = renderToStaticMarkup(createElement(PowerRuler, { value: 68 }));
    expect(html.match(/data-power-tick=/g)).toHaveLength(101);
    expect(html.match(/data-major="true"/g)).toHaveLength(11);
    expect(html).toContain('aria-valuenow="68"');
    expect(html).toContain('data-cursor="68"');
  });
  it.each([[10, 35, 1, 45], [10, 35, -1, 155], [-20, 60, 1, 40]])("uses simulation angle conventions (%s,%s,%s)", (tilt, elevation, facing, world) => {
    const html = renderToStaticMarkup(createElement(AngleDial, { tilt, elevation, facing: facing as -1 | 1 }));
    expect(html).toContain(`data-world-angle="${world}"`);
    expect(html).toContain(`data-ground-angle="${tilt}"`);
    expect(html).toContain(`data-elevation="${elevation}"`);
  });
});
