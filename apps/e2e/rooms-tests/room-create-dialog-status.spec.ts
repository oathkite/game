import { expect, test } from "@playwright/test";
import { enterRooms } from "./roomFlow";
// 部屋を作れなかった理由は、開いたままの作成ダイアログの中に出す（設計書 45.3）。
// モーダルの外は inert なので、背後の footer に出しても読み上げられない。
test("room creation failure is shown inside the open create dialog", async ({ page }, testInfo) => {
  await page.route("**/v2/rooms", route => route.request().method() === "POST" ? route.abort("connectionrefused") : route.continue());
  await enterRooms(page);
  await page.getByRole("button", { name: "部屋を作る", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "部屋を作る" });
  await dialog.getByRole("button", { name: "部屋を作る", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("対戦サーバーに接続できません。");
  await expect(page.getByText("対戦サーバーに接続できません。", { exact: true })).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "部屋を作る", exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("dialog-status.png") });

  await dialog.getByRole("button", { name: "閉じる" }).click();
  await page.getByRole("button", { name: "部屋を作る", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveCount(0);
});
