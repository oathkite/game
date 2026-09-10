import { expect, it } from "vitest";
import { resolveLanguage, translate } from "../src/i18n/locale";
it("uses saved preference, then Japanese browser language or English fallback", () => {
  expect(resolveLanguage("ja", "en-US")).toBe("ja");
  expect(resolveLanguage("en", "ja-JP")).toBe("en");
  expect(resolveLanguage(null, "ja-JP")).toBe("ja");
  expect(resolveLanguage("invalid", "fr-FR")).toBe("en");
});
it("translates known messages and preserves unknown names", () => {
  expect(translate("はじめる", "en")).toBe("Play");
  expect(translate("はじめる", "ja")).toBe("はじめる");
  expect(translate("player name", "en")).toBe("player name");
});
it("interpolates dynamic labels without translating player-supplied values", () => {
  expect(translate("参加者{n}のチーム", "ja", { n: 2 })).toBe("参加者2のチーム");
  expect(translate("参加者{n}のチーム", "en", { n: 2 })).toBe("Player 2 team");
  expect(translate("{team}チームの勝利", "en", { team: "赤" })).toBe("Team 赤 wins");
});
