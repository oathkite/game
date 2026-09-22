import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ResultPlayers } from "../src/worldUi/ResultPlayers";
import { RESULT_MOTION_MS, resultMotionEndMs } from "../src/worldUi/resultMotion";

const css = readFileSync(resolve("src/worldUi/resultPlayers.css"), "utf8");
const reducedBlocks = [...css.matchAll(/@media\(prefers-reduced-motion:reduce\) \{([^\n]*)\}/g)].map(match => match[1]!);

it("marks each row with the reaction the portrait styles key on", () => {
  const players = [{ playerId: "a", teamId: "t0" }, { playerId: "b", teamId: "t1" }];
  const win = renderToStaticMarkup(createElement(ResultPlayers, { players, result: { type: "win", teamId: "t0" } }));
  expect(win.match(/data-reaction="(\w+)"/g)).toEqual(['data-reaction="win"', 'data-reaction="lose"']);
});
it("greys out losers statically, so reduced motion keeps the cue", () => {
  expect(css).toContain(".result-table [data-reaction=lose] .tank-portrait { filter:grayscale(1); }");
  expect(reducedBlocks.some(block => block.includes("grayscale") || block.includes("[data-reaction=lose]"))).toBe(false);
  expect(css).not.toMatch(/\[data-reaction=draw\][^{]*\.tank-portrait/);
});
it("hops winners twice in steps after their row appears, and only while motion plays", () => {
  expect(css).toMatch(/\.battle-result-players\[data-motion=play\] \[data-reaction=win\] \.tank-portrait \{ animation:result-winner-hop 600ms steps\(1,end\) both; animation-delay:calc\(var\(--motion-delay, 0ms\) \+ var\(--row\) \* var\(--row-step, 90ms\) \+ 90ms\); \}/);
  const hop = css.match(/@keyframes result-winner-hop \{([^\n]*)\}/)![1]!;
  expect(hop.match(/translateY\(-2px\)/g)).toHaveLength(2);
  expect(reducedBlocks.some(block => block.includes("[data-reaction=win] .tank-portrait { animation:none!important; }"))).toBe(true);
});
it("keeps watching for a skip until the last winner has landed", () => {
  expect(resultMotionEndMs(0)).toBe(RESULT_MOTION_MS);
  expect(resultMotionEndMs(1)).toBe(RESULT_MOTION_MS);
  expect(resultMotionEndMs(2)).toBe(RESULT_MOTION_MS);
  expect(resultMotionEndMs(4)).toBe(3 * 90 + 90 + 600);
  expect(resultMotionEndMs(8)).toBe(7 * 68 + 90 + 600);
});
