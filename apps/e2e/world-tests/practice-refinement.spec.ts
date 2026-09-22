import { expect, test } from "@playwright/test";

test("モード選択とステージ選択を分け、戻る操作で一段ずつ戻る", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await expect(page.getByRole("button", { name: "ターゲットチャレンジ", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "自由練習", exact: true })).toBeVisible();
  await expect(page.locator(".practice-card")).toHaveCount(0);
  await page.getByRole("button", { name: "ターゲットチャレンジ", exact: true }).click();
  await expect(page.locator(".practice-card")).toHaveCount(8);
  await expect(page.getByRole("button", { name: "自由練習", exact: true })).toHaveCount(0);
  await page.goBack();
  await page.getByRole("button", { name: "自由練習", exact: true }).click();
  await expect(page.getByRole("heading", { name: "自由練習", exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole("button", { name: "ターゲットチャレンジ", exact: true }).click();
  await page.getByRole("button", { name: "ステージ1をはじめる" }).click();
  await page.getByRole("button", { name: "設定を開く", exact: true }).click();
  await page.getByRole("button", { name: "ステージ選択へ戻る" }).click();
  await expect(page.locator(".practice-card")).toHaveCount(8);
});

test("射撃後は移動しなくても自機へカメラが戻る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await page.getByRole("button", { name: "ターゲットチャレンジ", exact: true }).click();
  await page.getByRole("button", { name: "ステージ1をはじめる" }).click();
  const field = page.getByTestId("camera-world");
  const fire = page.getByRole("button", { name: "発射", exact: true });
  await expect(fire).toBeEnabled();
  await expect(field).toHaveAttribute("data-mode", "actor");
  const originalX = Number(await field.getAttribute("data-camera-x"));
  await page.keyboard.down("Space");
  await page.waitForTimeout(1500);
  await page.keyboard.up("Space");
  await expect(field).toHaveAttribute("data-mode", "shot");
  await expect.poll(async () => Math.abs(Number(await field.getAttribute("data-camera-x")) - originalX)).toBeGreaterThan(20);
  await expect(fire).toBeEnabled({ timeout: 20000 });
  await expect(field).toHaveAttribute("data-mode", "actor");
  await expect.poll(async () => Math.abs(Number(await field.getAttribute("data-camera-x")) - originalX)).toBeLessThan(1);
});
