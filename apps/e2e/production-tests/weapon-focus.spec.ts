import { expect, test } from "@playwright/test";

test("clicking a weapon preserves Space firing and keyboard aim", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click(); await page.getByRole("button", { name: "練習開始", exact: true }).click();
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
  const weapon = page.locator(".battle-weapons button").nth(1);
  await weapon.click();
  // WebKit does not focus buttons on mouse click; exercise the focused state too.
  await weapon.focus();
  await expect(weapon).toBeFocused();
  const angle = page.getByTestId("camera-angle");
  const before = await angle.textContent();
  await page.keyboard.press("w");
  await expect(angle).not.toHaveText(before!);
  await page.keyboard.down("Space");
  await expect.poll(async () => Number(await page.getByTestId("prototype-power").getAttribute("aria-valuenow"))).toBeGreaterThan(5);
  await page.keyboard.up("Space");
  await expect(page.locator(".battle-weapons button").first()).toBeDisabled();
});

test("aim and Space charge overlap without dropping either input", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await page.getByRole("button", { name: "練習開始", exact: true }).click();
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-opening", "false", { timeout: 15000 });
  const angle = page.getByTestId("camera-angle");
  const power = page.getByTestId("prototype-power");
  await page.keyboard.down("w");
  await page.keyboard.down("Space");
  await expect.poll(async () => Number(await power.getAttribute("aria-valuenow"))).toBeGreaterThan(5);
  await page.keyboard.up("w");
  const before = await angle.textContent();
  await page.keyboard.press("ArrowDown");
  await expect(angle).not.toHaveText(before!);
  const charged = Number(await power.getAttribute("aria-valuenow"));
  await expect.poll(async () => Number(await power.getAttribute("aria-valuenow"))).toBeGreaterThan(charged);
  await page.keyboard.up("Space");
  await expect(page.locator(".battle-weapons button").first()).toBeDisabled();
});
