import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { typedText } from "../src/worldUi/motion";
import { START_TEXT, START_TYPE_MS, StartSignal } from "../src/worldUi/StartSignal";

afterEach(() => { vi.unstubAllGlobals(); });
const render = () => renderToStaticMarkup(createElement(StartSignal, { visible: true }));

it("types START! one character every 40 ms", () => {
  expect([0, 40, 80, 120, 160, 200, 240, 1000].map(ms => typedText(START_TEXT, ms, START_TYPE_MS)))
    .toEqual(["", "S", "ST", "STA", "STAR", "START", "START!", "START!"]);
});
it("keeps the accessible name and the box size while typing", () => {
  const html = render();
  expect(html).toContain('role="status" aria-label="START!"');
  expect(html).toContain('<span class="battle-start-sr">START!</span>');
  expect(html).toContain('<span class="battle-start-rest">START!</span>');
  expect(renderToStaticMarkup(createElement(StartSignal, { visible: false }))).toBe("");
});
it("shows the whole word at once when motion is reduced", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
  expect(render()).toContain('START!<span class="battle-start-rest"></span>');
});
