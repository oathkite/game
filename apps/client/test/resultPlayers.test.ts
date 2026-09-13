import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ResultPlayers } from "../src/worldUi/ResultPlayers";

const players = [
  { playerId: "a", nickname: "Alive", teamId: "t0", hp: 100, eliminated: false },
  { playerId: "b", nickname: "Ally", teamId: "t0", hp: 0, eliminated: true },
  { playerId: "c", nickname: "Opponent", teamId: "t1", hp: 0, eliminated: true },
];
it("includes eliminated teammates in the authoritative team victory", () => {
  const html = renderToStaticMarkup(createElement(ResultPlayers, { players, result: { type: "win", teamId: "t0" } }));
  expect(html).toContain('aria-label="Alive：勝利"');
  expect(html).toContain('aria-label="Ally：勝利"');
  expect(html).toContain('aria-label="Opponent：敗北"');
});
it("uses neutral portraits for everyone in a draw and hides ongoing results", () => {
  const html = renderToStaticMarkup(createElement(ResultPlayers, { players, result: { type: "draw" } }));
  expect(html.match(/data-reaction="draw"/g)).toHaveLength(3);
  expect(html).not.toContain("pilot-result-expressions");
  expect(renderToStaticMarkup(createElement(ResultPlayers, { players, result: { type: "ongoing" } }))).toBe("");
});
