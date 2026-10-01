import { expect, test, type Page } from "@playwright/test";
import { startFreePractice } from "./practiceFlow";

// タッチの操作盤の並び（2026-10-02）。縦持ちはパワーと残り移動を盤の全幅の段に分け、横持ちは発射を右端の列で盤の高さいっぱいに広げる
const boxes = (page: Page) => page.evaluate(() => Object.fromEntries([".battle-console", ".battle-angle", ".battle-power", ".battle-movement", ".battle-weapons", ".battle-touch-fire"]
  .map(s => [s, document.querySelector(s)!.getBoundingClientRect().toJSON() as DOMRect])));
const open = async (page: Page) => {
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await startFreePractice(page);
  await expect(page.getByRole("button", { name: "発射", exact: true })).toBeVisible();
};

test("portrait touch console puts power and movement on full-width rows", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ja-JP", hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage(); await open(page);
    const b = await boxes(page), panel = b[".battle-console"]!, fire = b[".battle-touch-fire"]!;
    expect(panel.bottom).toBeLessThanOrEqual(844);
    for (const meter of [b[".battle-power"]!, b[".battle-movement"]!]) {
      expect(meter.width).toBeGreaterThanOrEqual(panel.width - 16 - 1);
      expect(meter.top).toBeGreaterThanOrEqual(fire.bottom);
    }
    // 角度、武器、発射は上の段に左から並び、発射は盤の中に収まる
    expect(b[".battle-angle"]!.right).toBeLessThanOrEqual(b[".battle-weapons"]!.left);
    expect(b[".battle-weapons"]!.right).toBeLessThanOrEqual(fire.left);
    expect(fire.right).toBeLessThanOrEqual(panel.right - 8 + 1);
    expect(fire.height).toBeGreaterThanOrEqual(88);
    // 武器の段の高さは発射のボタンの高さに揃う
    expect(Math.abs(b[".battle-weapons"]!.top - fire.top)).toBeLessThanOrEqual(1); expect(Math.abs(b[".battle-weapons"]!.height - fire.height)).toBeLessThanOrEqual(1);
  } finally { await context.close(); }
});

test("landscape touch console puts weapons left of a full-height fire button", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ja-JP", hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
  try {
    const page = await context.newPage(); await open(page);
    const b = await boxes(page), fire = b[".battle-touch-fire"]!;
    expect(b[".battle-weapons"]!.right).toBeLessThanOrEqual(fire.left);
    expect(b[".battle-power"]!.right).toBeLessThanOrEqual(b[".battle-weapons"]!.left);
    expect(fire.height).toBeGreaterThanOrEqual(88);
    expect(fire.right).toBeLessThanOrEqual(844);
    expect(Math.abs(b[".battle-weapons"]!.top - fire.top)).toBeLessThanOrEqual(1); expect(Math.abs(b[".battle-weapons"]!.height - fire.height)).toBeLessThanOrEqual(1);
  } finally { await context.close(); }
});
