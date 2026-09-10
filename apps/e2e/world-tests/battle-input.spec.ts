import { expect, test } from "@playwright/test";

test("desktop keyboard drives movement, aim and power; menus cancel charging", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティスへ" }).click();
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
  await expect(page.getByRole("button", { name: "発射", exact: true })).toHaveCount(0);
  const state = () => page.evaluate(() => { const v = window.__fortress!.getView(); return { x: v.control?.x, angle: v.control?.elevation, phase: v.phase }; });
  const before = await state();
  await page.keyboard.press("KeyD");
  await expect.poll(async () => (await state()).x).toBe(before.x! + 1);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await state()).x).toBe(before.x);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await state()).x).toBe(before.x! + 1);
  await page.keyboard.press("KeyA");
  await expect.poll(async () => (await state()).x).toBe(before.x);
  await page.keyboard.press("KeyW");
  await expect.poll(async () => (await state()).angle).toBe(before.angle! + 1);
  await page.keyboard.press("KeyS");
  await expect.poll(async () => (await state()).angle).toBe(before.angle);
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => (await state()).angle).toBe(before.angle! + 1);
  await page.keyboard.press("KeyE");
  await expect(page.locator(".battle-weapons button").nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("KeyQ");
  await expect(page.locator(".battle-weapons button").nth(0)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Digit2");
  await expect(page.locator(".battle-weapons button").nth(0)).toHaveAttribute("aria-pressed", "true");
  const field = page.getByTestId("camera-world");
  await page.keyboard.press("KeyC"); await page.waitForTimeout(350);
  const cameraX = Number(await field.getAttribute("data-camera-x"));
  await page.keyboard.press("Tab");
  await expect(field).toHaveAttribute("data-mode", "manual");
  await expect.poll(async () => Math.abs(Number(await field.getAttribute("data-camera-x")) - cameraX)).toBeGreaterThan(5);
  await page.keyboard.press("Tab");
  await expect.poll(async () => Math.abs(Number(await field.getAttribute("data-camera-x")) - cameraX)).toBeLessThan(1);
  await page.keyboard.down("Space");
  await expect.poll(async () => Number(await page.getByRole("meter", { name: "パワー" }).getAttribute("aria-valuenow"))).toBeGreaterThan(15);
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.keyboard.up("Space");
  expect((await state()).phase).toBe("acting");
  await page.getByRole("button", { name: "対戦に戻る" }).click();
  await expect(page.getByTestId("camera-world")).toBeFocused();
  await page.keyboard.down("Space"); await page.waitForTimeout(400); await page.keyboard.up("Space");
  await expect.poll(async () => (await state()).phase).not.toBe("acting");
});

test("touch controls remain usable and a physical gameplay key switches to keyboard UI", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 667, height: 375 } });
  const page = await context.newPage();
  try {
    await page.goto("/?prototype=world");
    await page.getByRole("button", { name: "はじめる", exact: true }).click();
    await page.getByRole("button", { name: "プラクティスへ" }).click();
    await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
    const fire = page.getByRole("button", { name: "発射", exact: true });
    await expect(fire).toBeVisible();
    await page.getByRole("button", { name: "角度を上げる" }).tap();
    await expect(page.getByTestId("camera-angle")).toHaveText("46°");
    await page.keyboard.press("ArrowDown");
    await expect(fire).toHaveCount(0);
    await expect(page.getByTestId("camera-angle")).toHaveText("45°");
  } finally { await context.close(); }
});
