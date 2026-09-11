import { expect, test } from "@playwright/test";

const back = async (page: import("@playwright/test").Page) => {
  await page.evaluate(() => history.back());
};
test("browser back follows menu parents and exits the title without trapping navigation", async ({ page }) => {
  await page.route("**/previous-page", route => route.fulfill({ contentType: "text/html", body: "<h1>Previous page</h1>" }));
  await page.goto("/previous-page");
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.getByRole("heading", { name: "整備と設定" })).toBeVisible();
  await back(page);
  await expect(page.getByRole("heading", { name: "出発の準備" })).toBeVisible();
  await back(page);
  await expect(page.getByRole("button", { name: "はじめる", exact: true })).toBeVisible();
  await back(page);
  await expect(page.getByRole("heading", { name: "Previous page" })).toBeVisible();
});

test("browser back cancels a charged shot and requires confirmation before leaving practice", async ({ page }) => {
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティスへ", exact: true }).click();
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
  await page.keyboard.down("Space");
  await expect.poll(async () => Number(await page.getByRole("meter", { name: "パワー" }).getAttribute("aria-valuenow"))).toBeGreaterThan(15);
  await back(page);
  const dialog = page.getByRole("dialog", { name: "ロビーへ戻りますか？" });
  await expect(dialog).toBeVisible();
  await page.keyboard.up("Space");
  expect(await page.evaluate(() => window.__fortress!.getView().phase)).toBe("acting");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
  await back(page);
  await dialog.getByRole("button", { name: "ロビーに戻る", exact: true }).click();
  await expect(page.getByRole("heading", { name: "出発の準備" })).toBeVisible();
});

test("reload does not accumulate history guards or leave the game", async ({ page }) => {
  await page.route("**/previous-page", route => route.fulfill({ contentType: "text/html", body: "<h1>Previous page</h1>" }));
  await page.goto("/previous-page");
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await expect(page.getByRole("heading", { name: "出発の準備" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "はじめる", exact: true })).toBeVisible();
  await back(page);
  await expect(page.getByRole("heading", { name: "Previous page" })).toBeVisible();
});
