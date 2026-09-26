import { expect, type Page } from "@playwright/test";

// プラクティスは「ターゲットチャレンジ」「自由練習」「CPU戦」のメニューを挟む（37章）。英語のテストでも同じ順で進む。
const labels = {
  ja: { practice: "プラクティス", free: "自由練習", start: "自由練習をはじめる" },
  en: { practice: "Practice", free: "Free Practice", start: "Start free practice" },
} as const;
type Language = keyof typeof labels;

/** ロビーから自由練習の設定画面（ステージと装備の選択）まで進む。 */
export const openFreePracticeSetup = async (page: Page, language: Language = "ja"): Promise<void> => {
  await page.getByRole("button", { name: labels[language].practice, exact: true }).click();
  await page.getByRole("button", { name: labels[language].free, exact: true }).click();
};

/** 設定画面を経て「自由練習をはじめる」を押す。戦場の読み込みは待たない。 */
export const beginFreePractice = async (page: Page, language: Language = "ja"): Promise<void> => {
  await openFreePracticeSetup(page, language);
  await page.getByRole("button", { name: labels[language].start, exact: true }).click();
};

/** 自由練習を始め、戦場の読み込みまで待つ。開始時のマップ紹介の終わりは待たない。 */
export const enterFreePractice = async (page: Page, language: Language = "ja"): Promise<void> => {
  await beginFreePractice(page, language);
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-loaded", "true");
};

/** ロビーから自由練習の対戦を始める。 */
export const startFreePractice = async (page: Page, language: Language = "ja"): Promise<void> => {
  await enterFreePractice(page, language);
  // 開始時のマップ紹介が終わるまで、手番の操作と残り時間は動かない。
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-opening", "false", { timeout: 15000 });
};

/** ロビーは見出しを持たないので、「出撃」ボタンで到達を確かめる。 */
export const lobby = (page: Page, language: Language = "ja") => page.getByRole("button", { name: language === "ja" ? "出撃" : "Deploy", exact: true });
