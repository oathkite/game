import { test, expect } from "@playwright/test";
import { assignTeam, enterRooms, joinByCode, mapOf, members, readyUp, waitForBattle } from "./roomFlow";

// 部屋を作るダイアログでランダムを選んでも部屋ができ、対戦を始められる（設計書 9 章）。
// 作成の要求がランダムを弾くと「対戦サーバーに接続できません。」と出て部屋に入れなかった。
test("creates and starts a room with the random map chosen in the create dialog", async ({ browser }) => {
  test.setTimeout(90000);
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ locale: "ja-JP" })));
  const [owner, guest] = await Promise.all(contexts.map(c => c.newPage()));
  try {
    for (const page of [owner!, guest!]) await enterRooms(page);
    await owner!.getByRole("button", { name: "部屋を作る", exact: true }).click();
    const dialog = owner!.getByRole("dialog", { name: "部屋を作る" });
    await dialog.getByRole("button", { name: /^マップを変更/ }).click();
    await owner!.getByRole("dialog", { name: "マップ" }).locator('button[data-map-id="random"]').click();
    await dialog.getByRole("button", { name: "部屋を作る", exact: true }).click();
    const code = owner!.getByTestId("room-code");
    await expect(code).toHaveText(/^[A-F0-9]{6}$/);
    await expect(mapOf(owner!)).toHaveAttribute("data-map-id", "random");
    await joinByCode(guest!, (await code.textContent())!);
    await expect(members(owner!)).toHaveCount(2);
    await assignTeam(owner!, 1, "t1");
    await readyUp(guest!);
    await owner!.getByRole("button", { name: "対戦開始", exact: true }).click();
    for (const page of [owner!, guest!]) await waitForBattle(page);
  } finally {
    await Promise.all(contexts.map(c => c.close()));
  }
});
