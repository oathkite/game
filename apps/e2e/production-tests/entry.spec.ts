import { expect, test } from "@playwright/test";
test("production root opens KEROPOD and practice with real assets", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("KEROPOD");
  const logo = page.getByRole("img", { name: "KEROPOD（ケロポッド）", exact: true });
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1536);
  await expect(page.getByText("2Dプレビュー", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await expect(page.getByRole("button", { name: "オンライン対戦", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "プラクティスへ", exact: true }).click();
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
  expect(errors).toEqual([]);
});
test("production invitation reaches the room screen without development controls", async ({ page }) => {
  await page.goto("/?room=ABCDEF");
  await expect(page.getByRole("textbox", { name: "部屋コード" })).toHaveValue("ABCDEF");
  await expect(page.getByRole("button", { name: "固定8席試験" })).toHaveCount(0);
});

test("production allocation uses the same origin when no separate server is configured", async ({ page }) => {
  await page.route("**/v2/rooms", route => route.fulfill({ status: 503, body: "unavailable" }));
  await page.goto("/?room=ABCDEF");
  const request = page.waitForRequest(request => new URL(request.url()).pathname === "/v2/rooms");
  await page.getByRole("button", { name: "部屋を作る", exact: true }).click();
  expect(new URL((await request).url()).origin).toBe("http://127.0.0.1:5188");
  await expect(page.getByText("対戦サーバーに接続できません。", { exact: true })).toBeVisible();
});
