import { expect, test, type Page } from "@playwright/test";

const capture = async (page: Page, scene: string) => {
  await page.locator(".world-shutter").evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  await page.screenshot({ path: `test-results/journey-${test.info().project.name}-${page.viewportSize()!.width}-${scene}.png` });
};

for (const viewport of [{ width: 1440, height: 900 }, { width: 667, height: 375 }]) {
  test.describe(`scene journey ${viewport.width}`, () => {
    test.use({ viewport, hasTouch: viewport.width < 1000 });
    test("settings persist through practice, results and lobby return", async ({ page }) => {
      const errors: string[] = [];
      const rasterRequests: string[] = [];
      page.on("request", request => { if (/\.(png|webp)(?:[?#]|$)/.test(request.url())) rasterRequests.push(request.url()); });
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "ARTILLERY", exact: true })).toBeVisible();
      await expect(page.locator(".world-start")).toBeVisible();
      await capture(page, "title");
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await page.getByRole("textbox", { name: "名前", exact: true }).fill("ケロポッド");
      await expect(page.locator(".tank-portrait")).toHaveAttribute("data-loaded", "true");
      await capture(page, "lobby");
      await page.getByRole("button", { name: "設定", exact: true }).click();
      await expect(page.getByRole("combobox", { name: "機体の表示サイズ" })).toHaveValue("9");
      await page.getByRole("button", { name: "音を消す", exact: true }).click();
      await expect(page.getByRole("button", { name: "音を出す", exact: true })).toHaveAttribute("aria-pressed", "true");
      await capture(page, "settings");
      await page.getByRole("combobox", { name: "機体の表示サイズ" }).selectOption("12");
      await page.getByRole("combobox", { name: "機体の表示サイズ" }).selectOption("9");
      await page.getByRole("button", { name: "ロビーに戻る", exact: true }).click();
      await page.getByRole("button", { name: "プラクティス", exact: true }).click(); await page.getByRole("button", { name: "練習開始", exact: true }).click();
      const field = page.getByTestId("camera-world");
      await expect(field).toHaveAttribute("data-loaded", "true", { timeout: 15000 });
      await expect(field).toHaveAttribute("data-opening", "false", { timeout: 15000 });
      await expect(field).toHaveAttribute("data-scale", "9");
      await expect(page.locator("[data-power-tick]")).toHaveCount(101);
      await capture(page, "battle");
      await page.getByRole("button", { name: "設定を開く", exact: true }).click();
      await page.getByRole("button", { name: "降参して対戦を終える", exact: true }).click();
      await expect(page.getByRole("heading", { name: /の勝利/ })).toBeVisible();
      await expect(page.locator('.battle-result-player[data-reaction="win"]')).toHaveCount(1);
      await expect(page.locator('.battle-result-player[data-reaction="lose"]')).toHaveCount(1);
      await capture(page, "result");
      await page.getByRole("button", { name: "ロビーに戻る", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "名前", exact: true })).toHaveValue("ケロポッド");
      await page.getByRole("button", { name: "設定", exact: true }).click();
      await expect(page.getByRole("button", { name: "音を出す", exact: true })).toHaveAttribute("aria-pressed", "true");
      expect(errors).toEqual([]);
      expect(rasterRequests).toEqual([]);
    });
  });
}
