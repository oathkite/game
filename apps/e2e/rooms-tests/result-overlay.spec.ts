import { expect, test } from "@playwright/test";
import { createRoom, enterRooms, joinByCode, readyUp, waitForBattle } from "./roomFlow";
import { turnOrder } from "./rosterReadability";
// 既知の不具合: 手番順リスト（TurnOrderList）は document.body への portal なので、対戦が終わっても結果画面の見出しと表に重なって残る。
// 直ったら test.fail を外す。
test("the turn order list leaves the screen when the result is shown", async ({ browser }) => {
  test.fail(true, "手番順リストが結果画面に残って重なる");
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ locale: "ja-JP", viewport: { width: 1440, height: 900 } })));
  const [owner, guest] = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const page of [owner!, guest!]) await enterRooms(page);
    await joinByCode(guest!, await createRoom(owner!));
    await readyUp(guest!);
    await owner!.getByRole("button", { name: "対戦開始", exact: true }).click();
    for (const page of [owner!, guest!]) await waitForBattle(page);
    await expect(turnOrder(owner!)).toHaveCount(2);
    await guest!.getByRole("button", { name: "設定を開く", exact: true }).click();
    await guest!.getByRole("button", { name: "降参", exact: true }).click();
    await expect(owner!.getByRole("heading", { name: "勝利", exact: true })).toBeVisible();
    await expect(turnOrder(owner!)).toHaveCount(0);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
