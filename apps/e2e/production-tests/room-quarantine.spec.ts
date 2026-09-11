import { expect, test } from "@playwright/test";
test("an unrecoverable room clears resume credentials and provides a lobby exit", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("keropod.room-token", "00000000-0000-4000-8000-000000000001");
    sessionStorage.setItem("keropod.room-id", "ABCDEF");
  });
  await page.routeWebSocket("**/v2/rooms/ABCDEF", ws => {
    ws.send(JSON.stringify({ type: "room.error", reason: "room-unrecoverable" }));
  });
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "オンライン対戦", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "部屋のデータを復元できませんでした。" })).toBeVisible();
  await expect(page.getByRole("button", { name: "再接続", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => [sessionStorage.getItem("keropod.room-token"), sessionStorage.getItem("keropod.room-id")])).toEqual([null, null]);
  await page.getByRole("button", { name: "ロビーに戻る", exact: true }).click();
  await expect(page.getByRole("button", { name: "オンライン対戦", exact: true })).toBeVisible();
});
