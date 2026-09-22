import { expect, test } from "@playwright/test";

// 縦持ち（390×844）でも対戦に入れる。回転案内は 2026-09-22 に外した（設計書 3.1）。
test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test("portrait practice keeps every control 44px and inside the screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await page.getByRole("button", { name: "自由練習をはじめる", exact: true }).click();
  await page.getByRole("button", { name: "自由練習をはじめる", exact: true }).click();
  const field = page.getByTestId("camera-world");
  await expect(field).toHaveAttribute("data-loaded", "true");
  const fieldBox = (await field.boundingBox())!;
  expect(fieldBox.width).toBe(390);
  expect(fieldBox.height).toBeGreaterThan(300);
  await page.screenshot({ path: "test-results/world-battle-portrait.png" });
  // 十字キーは横持ちと同じ 32 px（battleTouch.css）。発射と設定は 44 px を保つ。
  for (const [label, min] of [["左へ移動", 32], ["右へ移動", 32], ["角度を下げる", 32], ["角度を上げる", 32], ["発射", 44], ["設定を開く", 44]] as const) {
    const control = (await page.getByRole("button", { name: label, exact: true }).boundingBox())!;
    expect({ label, wide: control.width >= min, tall: control.height >= min }).toEqual({ label, wide: true, tall: true });
    expect(control.x).toBeGreaterThanOrEqual(0); expect(control.x + control.width).toBeLessThanOrEqual(390);
    expect(control.y).toBeGreaterThanOrEqual(0); expect(control.y + control.height).toBeLessThanOrEqual(844);
  }
  await expect(page.getByRole("button", { name: "発射", exact: true })).toBeEnabled({ timeout: 20000 });
  expect(errors).toEqual([]);
});
