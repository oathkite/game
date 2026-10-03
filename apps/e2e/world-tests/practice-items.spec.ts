import { expect, test, type Page } from "@playwright/test";
import { startFreePractice } from "./practiceFlow";

// 自由練習のアイテム（設計書 42）。交代で撃つ 2 人がそれぞれアイテムを使い、使用済みになり、再計算はサーバー役のエンジンと一致する
const item = (page: Page, name: string) => page.locator(".battle-items").getByRole("button", { name: new RegExp(`^${name}`) });
const viewOf = (page: Page) => page.evaluate(() => {
  const view = window.__fortress!.getView();
  return { phase: view.phase, seat: view.currentSeat, mismatches: view.mismatches, used: view.players?.map(p => p.itemsUsed ?? []) };
});
/** 手番が来るのを待ち、アイテムを選んで撃つ。撃った席を返す。先手は乱数で決まるので、席は決め打ちしない */
const shoot = async (page: Page, name: string, after?: 0 | 1): Promise<0 | 1> => {
  await expect.poll(async () => { const v = await viewOf(page); return v.phase === "acting" && v.seat !== after; }, { timeout: 30000 }).toBe(true);
  const seat = (await viewOf(page)).seat as 0 | 1;
  await item(page, name).click();
  await expect(item(page, name)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.down("Space"); await page.waitForTimeout(400); await page.keyboard.up("Space");
  return seat;
};

test.use({ viewport: { width: 1440, height: 900 } });
test("free practice players each use an item once and replays stay consistent", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await startFreePractice(page);
  const first = await shoot(page, "テレポート");
  // 同じ画面を交代で使うので、撃った機体の上に使ったアイテムのアイコンが出る（42.8）
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-item-popup", `${first}/teleport`);
  await expect.poll(async () => (await viewOf(page)).used?.[first], { timeout: 20000 }).toEqual(["teleport"]);
  const second = await shoot(page, "ダブルシュート", first);
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-item-popup", `${second}/double`);
  await page.screenshot({ path: "test-results/practice-item-popup.png" });
  await expect.poll(async () => (await viewOf(page)).used?.[second], { timeout: 20000 }).toEqual(["double"]);
  // 先に撃った席の次の手番では、使ったテレポートは押せず、ダブルシュートは押せる
  await expect.poll(async () => { const v = await viewOf(page); return v.phase === "acting" && v.seat === first; }, { timeout: 30000 }).toBe(true);
  await expect(item(page, "テレポート（使用済み）")).toBeDisabled();
  await expect(item(page, "ダブルシュート")).toBeEnabled();
  expect((await viewOf(page)).mismatches).toBe(0);
  expect(errors).toEqual([]);
});
