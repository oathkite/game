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
