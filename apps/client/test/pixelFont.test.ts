import { describe, expect, it } from "vitest";
import { isPaletteColor, PALETTE } from "@/game/palette";
import { opaqueBounds, TRANSPARENT } from "@/game/pixelGrid";
import { GLYPHS, logoPixels } from "@/game/pixelFont";

// 題名のドット文字。設計書 40.10。5 × 7 のグリフを 2 倍の太さで描き、輪郭と押し出しを付ける

describe("logoPixels", () => {
  it("TANK SHOOT の文字をすべて持つ", () => {
    for (const ch of "TANKSHO") expect(GLYPHS[ch]).toHaveLength(7);
  });
  it("幅は文字数に比例し、高さは 7 × 2 に輪郭と押し出しを足した 17 px", () => {
    const one = opaqueBounds(logoPixels("T"))!, two = opaqueBounds(logoPixels("TT"))!;
    expect(one.height).toBe(17);
    expect(two.width - one.width).toBe(12);
  });
  it("輪郭、押し出し、緑の 3 段の帯だけで塗る", () => {
    const colors = new Set(Array.from(logoPixels("TANK SHOOT").pixels).filter(c => c !== TRANSPARENT));
    expect(colors.has(PALETTE.outline)).toBe(true);
    expect(colors.has(PALETTE.greenDeep)).toBe(true);
    for (const c of [PALETTE.greenLight, PALETTE.green, PALETTE.greenMid]) expect(colors.has(c)).toBe(true);
    for (const c of colors) expect(isPaletteColor(c)).toBe(true);
  });
  it("知らない文字は空白として扱う", () => {
    expect(opaqueBounds(logoPixels("T?T"))!.width).toBe(opaqueBounds(logoPixels("T T"))!.width);
  });
});
