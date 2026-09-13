import { expect, test } from "@playwright/test";

test("practice countdown ring follows the remaining seconds", async ({ page }) => {
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティスへ", exact: true }).click();
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
  const dial = page.locator(".countdown-dial");
  const remaining = dial.locator("span");
  const arc = dial.locator("circle").nth(1);
  const seconds = Number(await remaining.innerText());
  await expect.poll(async () => Number(await remaining.innerText())).toBeLessThan(seconds);
  const next = Number(await remaining.innerText());
  await expect(arc).toHaveAttribute("stroke-dasharray", `${next * 5} 100`);
  const bounds = await dial.boundingBox();
  expect(bounds!.width).toBeGreaterThanOrEqual(40);
  expect(bounds!.height).toBeGreaterThanOrEqual(40);
  await page.screenshot({ path: "test-results/countdown-ring.png" });
});
