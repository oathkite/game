import { expect, it } from "vitest";
import { regionFromTimezone, validRegion } from "../src/worldUi/regionPreference";
it("uses timezone only as a geographic fallback", () => {
  expect(regionFromTimezone("Asia/Tokyo")).toBe("asia");
  expect(regionFromTimezone("Europe/Paris")).toBe("europe");
  expect(regionFromTimezone("America/New_York")).toBe("americas");
  expect(regionFromTimezone("Australia/Sydney")).toBe("asia");
  expect(regionFromTimezone("UTC")).toBe("asia");
});
it("rejects invalid saved or server regions", () => {
  expect(validRegion("europe")).toBe(true);
  expect(validRegion("invalid")).toBe(false);
  expect(validRegion(null)).toBe(false);
});
