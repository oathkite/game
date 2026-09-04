import { describe, expect, it } from "vitest";
import { MARKER_TOLERANCE, powerAtOffset, toggleMarker } from "@/ui/powerMarker";

// パワーゲージの目安ライン。押した位置を値にし、同じ位置をもう一度押すと消す。

describe("powerAtOffset", () => {
  it("上端が 100、下端が 0 になる", () => {
    expect(powerAtOffset(0, 200)).toBe(100);
    expect(powerAtOffset(200, 200)).toBe(0);
    expect(powerAtOffset(100, 200)).toBe(50);
  });

  it("ゲージの外を押しても 0 から 100 に収める", () => {
    expect(powerAtOffset(-50, 200)).toBe(100);
    expect(powerAtOffset(250, 200)).toBe(0);
  });

  it("高さが 0 のときは 0 にする", () => {
    expect(powerAtOffset(10, 0)).toBe(0);
  });
});

describe("toggleMarker", () => {
  it("ラインが無ければ引く", () => {
    expect(toggleMarker(null, 70)).toBe(70);
  });

  it("同じ位置を押したら消す", () => {
    expect(toggleMarker(70, 70)).toBeNull();
    expect(toggleMarker(70, 70 + MARKER_TOLERANCE)).toBeNull();
    expect(toggleMarker(70, 70 - MARKER_TOLERANCE)).toBeNull();
  });

  it("離れた位置を押したら引き直す", () => {
    expect(toggleMarker(70, 70 + MARKER_TOLERANCE + 1)).toBe(74);
    expect(toggleMarker(70, 30)).toBe(30);
  });
});
