import { expect, test, type Page } from "@playwright/test";
import { startFreePractice } from "./practiceFlow";

// 対戦画面の全画面（設計書 30 章）。設定の右隣のボタンと F で出入りし、M で設定を開く。
// 全画面に入れない端末（iPhone の Safari）ではボタンを出さない。
const SIZES = [
  { name: "desktop", viewport: { width: 1280, height: 800 }, hasTouch: false },
  { name: "landscape-phone", viewport: { width: 844, height: 390 }, hasTouch: true },
  { name: "portrait-phone", viewport: { width: 390, height: 844 }, hasTouch: true },
  { name: "narrow-portrait-phone", viewport: { width: 360, height: 800 }, hasTouch: true },
] as const;

const button = (page: Page) => page.getByRole("button", { name: "全画面", exact: true });
const fullscreenElement = (page: Page) => page.evaluate(() => document.fullscreenElement?.tagName ?? null);
const box = (page: Page, selector: string) => page.evaluate(s => document.querySelector(s)?.getBoundingClientRect().toJSON() as DOMRect | undefined, selector);
const overlaps = (a: DOMRect, b: DOMRect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const open = async (page: Page): Promise<void> => {
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await startFreePractice(page);
};

for (const size of SIZES) {
  test(`fullscreen button sits right of the menu without covering the HUD (${size.name})`, async ({ browser }) => {
    const context = await browser.newContext({ locale: "ja-JP", viewport: size.viewport, hasTouch: size.hasTouch, isMobile: size.hasTouch });
    try {
      const page = await context.newPage(); await open(page);
      await expect(button(page)).toBeVisible();
      const menu = (await box(page, ".battle-menu"))!, fullscreen = (await box(page, ".battle-fullscreen"))!;
      // 設定と同じ高さに並べ、押せる大きさを揃える
      expect(fullscreen.top).toBeCloseTo(menu.top, 0);
      expect(fullscreen.width).toBeCloseTo(menu.width, 0); expect(fullscreen.height).toBeCloseTo(menu.height, 0);
      expect(fullscreen.left - menu.right).toBeCloseTo(8, 0);
      for (const selector of [".practice-battle-status", ".battle-floating-timer", ".turn-order-list", ".kp-minimap", ".battle-console"]) {
        const other = await box(page, selector);
        if (other && other.width > 0) expect({ selector, overlaps: overlaps(fullscreen, other) }).toEqual({ selector, overlaps: false });
      }
      // ボタンを足しても「自由練習」は 1 行に収まり、残り時間と手番の一覧に重ならない。縦持ちはボタンの下の段へ移る
      const status = (await box(page, ".practice-battle-status"))!;
      expect(status.height).toBeLessThan(30);
      for (const selector of [".battle-menu", ".battle-floating-timer", ".turn-order-list", ".kp-minimap"]) {
        const other = await box(page, selector);
        if (other && other.width > 0) expect({ selector, overlaps: overlaps(status, other) }).toEqual({ selector, overlaps: false });
      }
      await page.screenshot({ path: `test-results/fullscreen-${size.name}.png` });
    } finally { await context.close(); }
  });
}

test("button and F toggle fullscreen on the whole document, M opens the menu", async ({ page }) => {
  await open(page);
  await expect(button(page)).toHaveAttribute("aria-pressed", "false");

  await button(page).click();
  await expect.poll(() => fullscreenElement(page)).toBe("HTML");
  await expect(button(page)).toHaveAttribute("aria-pressed", "true");
  // ボタンにフォーカスが残っていても、Space は発射に使われ、全画面を抜けない
  await page.keyboard.down("Space"); await page.keyboard.up("Space");
  await expect.poll(() => fullscreenElement(page)).toBe("HTML");
  await button(page).click();
  await expect.poll(() => fullscreenElement(page)).toBeNull();
  await expect(button(page)).toHaveAttribute("aria-pressed", "false");

  await page.locator("body").press("f");
  await expect.poll(() => fullscreenElement(page)).toBe("HTML");
  // 全画面の中でも M で設定が開く。開いている間も F で全画面を抜けられる
  await page.keyboard.press("m");
  await expect(page.locator(".kp-dialog[open]")).toBeVisible();
  await page.keyboard.press("m");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.keyboard.press("f");
  await expect.poll(() => fullscreenElement(page)).toBeNull();
});

test("no fullscreen button where the browser cannot enter fullscreen", async ({ page }) => {
  // iPhone の Safari は要素の全画面を持たない。fullscreenEnabled が false の環境で代える。
  // Chromium は webkit 接頭辞の名前も持つので、両方を false にする
  await page.addInitScript(() => { for (const name of ["fullscreenEnabled", "webkitFullscreenEnabled"]) Object.defineProperty(Document.prototype, name, { get: () => false }); });
  await open(page);
  await expect(page.locator(".battle-menu")).toBeVisible();
  await expect(page.locator(".battle-fullscreen")).toHaveCount(0);
  // F を押しても何も起きず、M は効く
  await page.keyboard.press("f");
  expect(await fullscreenElement(page)).toBeNull();
  await page.keyboard.press("m");
  await expect(page.locator(".kp-dialog[open]")).toBeVisible();
});
