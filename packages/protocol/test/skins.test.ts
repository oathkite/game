import { describe, expect, it } from "vitest";
import { DEFAULT_FRAME, DEFAULT_TURRET, FRAME_SKINS, frameSkinOf, TURRET_SKINS, turretSkinOf } from "../src/index.js";

// 描く前にスキンを確かめる（設計書 43.9）。知らないスキンや欠けた値は既定のスキンで描く

describe("frameSkinOf と turretSkinOf", () => {
  it("候補にあるスキンはそのまま返す", () => {
    for (const frame of FRAME_SKINS) expect(frameSkinOf(frame)).toBe(frame);
    for (const turret of TURRET_SKINS) expect(turretSkinOf(turret)).toBe(turret);
  });
  it("欠けた値と、後から足されて知らないスキンは既定のスキンにする", () => {
    for (const value of [undefined, null, "", "futureSkin", 3, {}]) {
      expect(frameSkinOf(value), String(value)).toBe(DEFAULT_FRAME);
      expect(turretSkinOf(value), String(value)).toBe(DEFAULT_TURRET);
    }
  });
});
