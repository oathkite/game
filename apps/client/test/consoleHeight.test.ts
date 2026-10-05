import { expect, it } from "vitest";
import { battleConsoleHeight, touchConsoleHeight } from "../src/worldUi/consoleHeight";

it("タッチの操作盤は、縦持ちのスマートフォンだけパワーと残り移動を別の段にして高くする", () => {
  expect(touchConsoleHeight(390, 844)).toBe(216);
  expect(touchConsoleHeight(844, 390)).toBe(112);
  expect(touchConsoleHeight(768, 1024)).toBe(112);
});

it("対戦と練習の盤面は、同じ操作盤の高さを引いて求める", () => {
  expect(battleConsoleHeight(390, 844, true)).toBe(216);
  expect(battleConsoleHeight(1440, 900, false)).toBe(160);
  expect(battleConsoleHeight(1100, 800, false)).toBe(120);
  expect(battleConsoleHeight(1440, 480, false)).toBe(96);
  expect(battleConsoleHeight(900, 800, false)).toBe(96);
  // 広い画面の境目（1200 × 700）
  expect(battleConsoleHeight(1200, 700, false)).toBe(160);
  expect(battleConsoleHeight(1199, 700, false)).toBe(120);
});
