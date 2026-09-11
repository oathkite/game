import { expect, test } from "@playwright/test";
for (const viewport of [{ width: 1440, height: 900 }, { width: 667, height: 375 }]) {
  test(`first practice hints can be skipped and revisited at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/?prototype=world");
    await page.getByRole("button", { name: "はじめる", exact: true }).click();
    const guide = page.locator(".practice-guide");
    await expect(guide).toHaveAttribute("open", "");
    await expect(guide).toContainText("風を読む");
    const practice = page.getByRole("button", { name: "プラクティスへ", exact: true });
    const box = (await practice.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await guide.getByText("操作のヒント", { exact: true }).click();
    await expect(guide).not.toHaveAttribute("open");
    await page.reload();
    await page.getByRole("button", { name: "はじめる", exact: true }).click();
    await expect(guide).not.toHaveAttribute("open");
    await guide.getByText("操作のヒント", { exact: true }).click();
    await expect(guide).toHaveAttribute("open", "");
    await practice.click();
    await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
    await expect(guide).toHaveCount(0);
  });
}

test("portrait touch hints use translated controls and keep the primary action on screen", async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ hasTouch: true, locale: "en-US", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/?prototype=world`);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const guide = page.locator(".practice-guide");
    await expect(guide).toContainText("Hold Fire");
    await expect(guide).not.toContainText("Space");
    const button = page.getByRole("button", { name: "Practice", exact: true });
    const box = (await button.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    await guide.scrollIntoViewIfNeeded();
    await page.locator(".world-shutter").evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    await page.screenshot({ path: testInfo.outputPath("guide-touch.png") });
    await guide.getByText("How to play", { exact: true }).tap();
    await expect(guide).not.toHaveAttribute("open");
  } finally { await context.close(); }
});

test("unavailable hint storage still permits dismissal and practice", async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === "keropod.practice-guide-seen") throw new DOMException("Blocked", "SecurityError");
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "keropod.practice-guide-seen") throw new DOMException("Blocked", "SecurityError");
      set.call(this, key, value);
    };
  });
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.locator(".practice-guide summary").click();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByRole("button", { name: "ロビーに戻る", exact: true }).click();
  await expect(page.locator(".practice-guide")).not.toHaveAttribute("open");
  await page.getByRole("button", { name: "プラクティスへ", exact: true }).click();
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
});
