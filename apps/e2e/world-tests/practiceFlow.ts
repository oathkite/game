import { expect, type Page } from "@playwright/test";

// ロビーから自由練習の対戦を始める。プラクティスは「ターゲットチャレンジ」「自由練習」「CPU戦」のメニューを挟む（37章）。
export const startFreePractice = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await page.getByRole("button", { name: "自由練習", exact: true }).click();
  await page.getByRole("button", { name: "自由練習をはじめる", exact: true }).click();
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
  // 開始時のマップ紹介が終わるまで、手番の操作と残り時間は動かない。
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-opening", "false", { timeout: 15000 });
};

/** ロビーは見出しを持たないので、「出撃」ボタンで到達を確かめる。 */
export const lobby = (page: Page) => page.getByRole("button", { name: "出撃", exact: true });
