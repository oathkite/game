import { expect, it } from "vitest";
import { TEAM_COLORS, TEAM_COLOR_NAMES, teamColor, teamColorName } from "../src/worldUi/teamColors";
import { translate } from "../src/i18n/locale";
it("gives every one of eight teams a distinct color and translated color name", () => {
  expect(new Set(TEAM_COLORS).size).toBe(8);
  expect(new Set(TEAM_COLOR_NAMES).size).toBe(8);
  for (let team = 0; team < 8; team++) {
    expect(teamColor(team)).toMatch(/^#[0-9a-f]{6}$/);
    expect(translate(teamColorName(team), "en")).not.toBe(teamColorName(team));
    expect(translate("{color}チーム", "en", { color: translate(teamColorName(team), "en") })).toMatch(/ team$/);
  }
});
