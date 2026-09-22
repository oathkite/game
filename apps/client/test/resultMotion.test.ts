import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { countUpAt, listenForSkip, RESULT_COUNT_STEP_MS, RESULT_COUNT_STEPS, RESULT_CROWN_BLINK_MS, RESULT_MOTION_MS, resultRowStepMs } from "../src/worldUi/resultMotion";
import { ResultPlayers } from "../src/worldUi/ResultPlayers";

afterEach(() => { vi.unstubAllGlobals(); });

const players = [
  { playerId: "a", nickname: "Alive", teamId: "t0" },
  { playerId: "b", nickname: "Ally", teamId: "t0" },
  { playerId: "c", nickname: "Opponent", teamId: "t1" },
];
const stats = { a: { shots: 8, enemyDamage: 120, friendlyDamage: 0, selfDamage: 7 }, c: { shots: 3, enemyDamage: 40, friendlyDamage: 5, selfDamage: 0 } };
const render = () => renderToStaticMarkup(createElement(ResultPlayers, { players, stats, result: { type: "win", teamId: "t0" } }));

it("counts up in eight 40 ms steps and rounds each step down", () => {
  expect(countUpAt(-90, 120)).toBe(0);
  expect(countUpAt(0, 120)).toBe(0);
  expect(countUpAt(39, 120)).toBe(0);
  expect(countUpAt(40, 120)).toBe(15);
  expect(countUpAt(40, 7)).toBe(0);
  expect(countUpAt(160, 120)).toBe(60);
  expect(countUpAt(319, 7)).toBe(6);
  expect(countUpAt(320, 7)).toBe(7);
  expect(countUpAt(10_000, 120)).toBe(120);
  expect(countUpAt(200, 0)).toBe(0);
  expect(countUpAt(0, 5, 0)).toBe(5);
});
it("fits rows, count-up and the crown blinks into 800 ms for up to eight players", () => {
  expect(resultRowStepMs(0)).toBe(90);
  expect(resultRowStepMs(1)).toBe(90);
  expect(resultRowStepMs(2)).toBe(90);
  expect(resultRowStepMs(6)).toBe(90);
  expect(resultRowStepMs(8)).toBe(68);
  for (let rows = 1; rows <= 8; rows++) {
    const lastRow = (rows - 1) * resultRowStepMs(rows);
    expect(lastRow + RESULT_COUNT_STEPS * RESULT_COUNT_STEP_MS).toBeLessThanOrEqual(RESULT_MOTION_MS);
    expect(lastRow + 2 * RESULT_CROWN_BLINK_MS).toBeLessThanOrEqual(RESULT_MOTION_MS);
  }
});
it("skips on a click or a key press until released", () => {
  const target = new EventTarget();
  const onSkip = vi.fn();
  const stop = listenForSkip(target, onSkip);
  target.dispatchEvent(new Event("keydown"));
  target.dispatchEvent(new Event("pointerdown"));
  expect(onSkip).toHaveBeenCalledTimes(2);
  stop();
  target.dispatchEvent(new Event("keydown"));
  expect(onSkip).toHaveBeenCalledTimes(2);
});
it("starts the rows staggered from zero while motion is allowed", () => {
  const html = render();
  expect(html).toContain('data-motion="play"');
  expect(html).toContain("--row-step:90ms");
  expect(html.match(/--row:\d/g)).toEqual(["--row:0", "--row:1", "--row:2"]);
  expect(html).not.toContain(">120<");
  expect(html).toContain("<td>—</td>");
});
it("can hold the whole staging until the shutter has opened", () => {
  const html = renderToStaticMarkup(createElement(ResultPlayers, { players, stats, result: { type: "win", teamId: "t0" }, motionDelayMs: 400 }));
  expect(html).toContain("--motion-delay:400ms");
  expect(html).toContain("<td>0</td><td>0</td><td>0</td><td>0</td>");
  expect(render()).toContain("--motion-delay:0ms");
});
it("shows the final numbers at once when motion is reduced", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
  const html = render();
  expect(html).toContain('data-motion="done"');
  expect(html).toContain("<td>8</td><td>120</td><td>0</td><td>7</td>");
  expect(html).toContain("<td>3</td><td>40</td><td>5</td><td>0</td>");
});
