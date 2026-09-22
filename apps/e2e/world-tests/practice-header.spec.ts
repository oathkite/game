import { expect, test } from "@playwright/test";

for (const language of ["ja", "en"] as const) {
  test(`練習画面のヘッダーを設定言語だけで統一する: ${language}`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "はじめる", exact: true }).click();
    if (language === "en") {
      await page.getByRole("button", { name: "設定", exact: true }).click();
      await page.getByRole("combobox", { name: "Language / 言語", exact: true }).selectOption("en");
      await page.getByRole("button", { name: "Close", exact: true }).click();
    }
    const labels = language === "ja" ? ["プラクティス", "ターゲットチャレンジ", "自由練習", "プラクティスへ戻る"] : ["Practice", "Target Challenge", "Free Practice", "Back to practice"];
    await page.getByRole("button", { name: labels[0]!, exact: true }).click();
    const header = page.locator(".practice-header");
    await expect(header.getByRole("heading", { level: 1 })).toHaveText(labels[0]!);
    await expect(header.locator(".label")).toHaveCount(0);
    for (const label of labels.slice(1, 3)) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(header.getByRole("heading", { level: 1 })).toHaveText(label!);
      await expect(header.locator(".label")).toHaveCount(0);
      await page.getByRole("button", { name: labels[3]!, exact: true }).click();
    }
  });
}
