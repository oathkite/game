import { describe, expect, it } from "vitest";
import { COLOR_HEX, PLAYER_COLORS } from "@game/protocol";
import { cssHex, FIRE_RAMP, isPaletteColor, PALETTE, rampOf, SMOKE_RAMP, TEAM_RAMPS } from "@/game/palette";

// 設計書 40.4 の固定パレット。描く画素はすべてこの表の色にする

const luminance = (color: number): number => {
  const r = Math.floor(color / 0x10000), g = Math.floor(color / 0x100) % 0x100, b = color % 0x100;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("PALETTE", () => {
  it("共有の色は重複のない 50 色", () => {
    const values = Object.values(PALETTE);
    expect(values).toHaveLength(50);
    expect(new Set(values).size).toBe(50);
  });
  it("UI の緑と地の黒をそのまま持つ", () => {
    expect(PALETTE.green).toBe(0x33ff66);
    expect(PALETTE.black).toBe(0x000000);
  });
  it("炎は白から暗い赤へ、煙は明るい灰から暗い灰へ並ぶ", () => {
    expect(FIRE_RAMP[0]).toBe(PALETTE.white);
    expect(FIRE_RAMP).toHaveLength(7);
    expect(SMOKE_RAMP).toHaveLength(4);
    for (let i = 1; i < FIRE_RAMP.length; i++) expect(luminance(FIRE_RAMP[i]!)).toBeLessThan(luminance(FIRE_RAMP[i - 1]!));
    for (let i = 1; i < SMOKE_RAMP.length; i++) expect(luminance(SMOKE_RAMP[i]!)).toBeLessThan(luminance(SMOKE_RAMP[i - 1]!));
  });
});

describe("TEAM_RAMPS", () => {
  it("すべての主色に、基準が protocol の色と同じ 4 段を持つ", () => {
    for (const color of PLAYER_COLORS) {
      const ramp = TEAM_RAMPS[color];
      expect(ramp.base).toBe(Number.parseInt(COLOR_HEX[color].slice(1), 16));
      expect(luminance(ramp.light)).toBeGreaterThan(luminance(ramp.base));
      expect(luminance(ramp.shadow)).toBeLessThan(luminance(ramp.base));
      expect(luminance(ramp.deep)).toBeLessThan(luminance(ramp.shadow));
    }
  });
  it("rampOf は protocol の色の値から段を引く", () => {
    expect(rampOf(COLOR_HEX.blue)).toBe(TEAM_RAMPS.blue);
    expect(rampOf("#123456")).toBeNull();
  });
});

describe("isPaletteColor", () => {
  it("共有の色とチームの色の段だけを通す", () => {
    expect(isPaletteColor(PALETTE.outline)).toBe(true);
    expect(isPaletteColor(TEAM_RAMPS.pink.deep)).toBe(true);
    expect(isPaletteColor(0x123456)).toBe(false);
  });
});

describe("cssHex", () => {
  it("6 桁の #rrggbb にする", () => {
    expect(cssHex(PALETTE.green)).toBe("#33ff66");
    expect(cssHex(PALETTE.black)).toBe("#000000");
    expect(cssHex(PALETTE.sky1)).toBe("#0b1122");
  });
});
