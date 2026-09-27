import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isPaletteColor } from "@/game/palette";

// UI の CSS 変数は 40.4 の固定パレットと同じ値にする（設計書 40.4、40.10）

describe("pixelTheme.css", () => {
  it("--px- の色はすべて固定パレットの色", () => {
    const css = readFileSync(fileURLToPath(new URL("../src/worldUi/pixelTheme.css", import.meta.url)), "utf8");
    const colors = [...css.matchAll(/--px-[a-z0-9-]+:\s*#([0-9a-f]{6})/gi)].map(m => Number.parseInt(m[1]!, 16));
    expect(colors.length).toBeGreaterThan(8);
    for (const c of colors) expect(isPaletteColor(c), c.toString(16)).toBe(true);
  });
});
