import { describe, expect, it } from "vitest";
import { TEAM_RAMPS } from "@/game/palette";
import { TRANSPARENT } from "@/game/pixelGrid";
import { paintTitleScene } from "@/game/titleScene";
import { offPalette } from "./offPalette";

// タイトル画面の背景。設計書 40.10。対戦と同じ夜空、山並み、地形、機体を 1 枚に描く

describe("paintTitleScene", () => {
  it("指定の大きさを隙間なく塗り、固定パレットの色だけを使う", () => {
    for (const [w, h] of [[288, 180], [96, 211], [160, 90]] as const) {
      const scene = paintTitleScene(w, h);
      expect(scene.width).toBe(w);
      expect(scene.height).toBe(h);
      expect(scene.pixels.includes(TRANSPARENT)).toBe(false);
      expect(offPalette(scene.pixels), `${w}x${h}`).toEqual([]);
    }
  });
  it("向かい合う 2 台の機体を描く（赤と青の車体の色がある）", () => {
    const colors = new Set(paintTitleScene(288, 180).pixels);
    expect(colors.has(TEAM_RAMPS.red.base)).toBe(true);
    expect(colors.has(TEAM_RAMPS.blue.base)).toBe(true);
  });
  it("同じ大きさなら同じ絵になる", () => {
    expect(Array.from(paintTitleScene(120, 80).pixels).join()).toBe(Array.from(paintTitleScene(120, 80).pixels).join());
  });
});
