import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RoomTeamSummary } from "../src/worldUi/RoomTeamSummary";
const render = (teams: (string | null)[]) => renderToStaticMarkup(createElement(RoomTeamSummary, { members: teams.map(teamId => ({ teamId })) }));
it("shows the current unequal team sizes before starting", () => {
  const html = render(["t0", "t1", "t1"]);
  expect(html).toContain("青チーム: 1人");
  expect(html).toContain("赤チーム: 2人");
  expect(html).toContain("人数差あり");
});
it("does not label equal teams or free-for-all as unequal", () => {
  for (const teams of [["t0", "t0", "t1", "t1"], ["t0", "t1", "t2"]]) expect(render(teams)).not.toContain("人数差あり");
});
it("keeps unassigned members separate and recomputes after a team move", () => {
  expect(render(["t0", null])).toContain("未配置: 1人");
  expect(render(["t0", null])).not.toContain("人数差あり");
  expect(render(["t0", "t1", "t1", "t0"])).not.toContain("人数差あり");
});
