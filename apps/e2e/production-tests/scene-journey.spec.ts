import { expect, test, type Page } from "@playwright/test";
import { beginFreePractice } from "../world-tests/practiceFlow";

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
      await expect(page.getByRole("heading", { name: "TANK SHOOT", exact: true })).toBeVisible();
      await expect(page.locator(".world-start")).toBeVisible();
      await capture(page, "title");
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await page.getByRole("textbox", { name: "名前", exact: true }).fill("テスト機");
      await expect(page.locator(".tank-portrait")).toHaveAttribute("data-loaded", "true");
      await capture(page, "lobby");
      await page.getByRole("button", { name: "設定", exact: true }).click();
      await page.getByRole("button", { name: "音を消す", exact: true }).click();
      await expect(page.getByRole("button", { name: "音を出す", exact: true })).toHaveAttribute("aria-pressed", "true");
      await capture(page, "settings");
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
      await beginFreePractice(page);
      const field = page.getByTestId("camera-world");
      await expect(field).toHaveAttribute("data-loaded", "true", { timeout: 15000 });
      await expect(field).toHaveAttribute("data-opening", "false", { timeout: 15000 });
      // 通常のカメラは 8 CSS px/cell（loadCameraScale、設計書 40.3）。
      await expect(field).toHaveAttribute("data-scale", "8");
      await expect(page.locator("[data-power-tick]")).toHaveCount(101);
      await capture(page, "battle");
      await page.getByRole("button", { name: "設定を開く", exact: true }).click();
      await page.getByRole("button", { name: "降参して対戦を終える", exact: true }).click();
      // 自由練習の見出しは、終了時に手番だった側の勝敗（37.4）。先攻で「勝利」にも「敗北」にもなるので、文言は見ない。
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = page.getByRole("table", { name: "試合成績" });
      await expect(results.getByRole("cell", { name: "勝利", exact: true })).toHaveCount(1);
      await expect(results.getByRole("cell", { name: "敗北", exact: true })).toHaveCount(1);
      await expect(page.locator(".result-table-scroll")).toHaveAttribute("data-motion", "done", { timeout: 15000 });
      await capture(page, "result");
      // リザルトからプラクティスのメニューへ戻り、そこから出撃準備（ロビー）へ戻る（37章）。
      await page.getByRole("button", { name: "プラクティス", exact: true }).click();
      await page.getByRole("button", { name: "出撃準備へ戻る", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "名前", exact: true })).toHaveValue("テスト機");
      await page.getByRole("button", { name: "設定", exact: true }).click();
      await expect(page.getByRole("button", { name: "音を出す", exact: true })).toHaveAttribute("aria-pressed", "true");
      expect(errors).toEqual([]);
      expect(rasterRequests).toEqual([]);
    });
  });
}
