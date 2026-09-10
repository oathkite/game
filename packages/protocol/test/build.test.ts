import { expect, it } from "vitest";
import { CLIENT_BUILD, compatibleBuild, matchBuild } from "../src/build";
it("rejects missing and mismatched client versions", () => {
  expect(compatibleBuild(CLIENT_BUILD)).toBe(true);
  expect(compatibleBuild(undefined)).toBe(false);
  for (const key of ["protocol", "sim", "assets", "rules"] as const) expect(compatibleBuild({ ...CLIENT_BUILD, [key]: "old" })).toBe(false);
});
it("fixes a match to its map identity and revision", () => {
  expect(matchBuild({ id: "moss-valley", version: 1 })).toEqual({ ...CLIENT_BUILD, map: { id: "moss-valley", version: 1 } });
});
