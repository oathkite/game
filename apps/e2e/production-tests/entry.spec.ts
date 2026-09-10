import { expect, test } from "@playwright/test";
test("production root opens KEROPOD and practice with real assets", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    (window as Window & { webglRequests?: number }).webglRequests = 0;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).includes("webgl")) { const state = window as Window & { webglRequests?: number }; state.webglRequests = (state.webglRequests ?? 0) + 1; }
      return Reflect.apply(original, this, args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page).toHaveTitle("KEROPOD");
  const logo = page.getByRole("img", { name: "KEROPOD（ケロポッド）", exact: true });
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1536);
  await expect(page.getByText("2Dプレビュー", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { webglRequests?: number }).webglRequests)).toBe(0);
  await page.waitForLoadState("networkidle");
  const initialBytes = await page.evaluate(() => [...performance.getEntriesByType("navigation"), ...performance.getEntriesByType("resource")].reduce((total, entry) => total + (entry as PerformanceResourceTiming).encodedBodySize, 0));
  console.info(`Cold title encoded transfer: ${initialBytes} bytes`);
  expect(initialBytes).toBeGreaterThan(0);
  expect(initialBytes).toBeLessThanOrEqual(2_000_000);
  await test.info().attach("title-transfer.json", { body: JSON.stringify({ initialBytes }), contentType: "application/json" });
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await expect(page.getByRole("button", { name: "オンライン対戦", exact: true })).toBeVisible();
  await expect(page.locator(".world-machine svg").first()).toBeVisible();
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

test("a failed battle chunk offers a reload instead of a blank screen", async ({ page }) => {
  await page.route("**/assets/CameraPrototype-*.js", route => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティスへ", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("画面を読み込めませんでした");
  await page.unroute("**/assets/CameraPrototype-*.js");
  await page.getByRole("button", { name: "再読み込み", exact: true }).click();
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティスへ", exact: true }).click();
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
});
