import { expect, test } from "@playwright/test";
import { assignTeam, createRoom, enterRooms, joinByCode, members } from "./roomFlow";
// 22.1 の「人数差あり」を開始前に全員へ示す（TBD-30 を 45 章で解消）。狭い横画面では一覧の見出しに出る。

test("all members see team counts update on reassignment and departure", async ({ browser }, testInfo) => {
  const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext({ locale: "ja-JP", viewport: { width: 667, height: 375 } })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const page of pages) await enterRooms(page);
    const owner = pages[0]!;
    const code = await createRoom(owner);
    for (const page of pages.slice(1)) await joinByCode(page, code);
    await expect(members(owner)).toHaveCount(3);
    await assignTeam(owner, 1, "t1");
    await assignTeam(owner, 2, "t1");
    for (const page of pages) {
      await expect(page.getByRole("list", { name: "チーム編成" })).toHaveText("青チーム: 1人赤チーム: 2人");
      await expect(page.getByText("人数差あり", { exact: true })).toBeVisible();
    }
    await owner.screenshot({ path: testInfo.outputPath("team-counts.png") });
    // 主操作は狭い横画面でもスクロールせずに見える（45.3）
    const start = (await owner.getByRole("button", { name: "対戦開始", exact: true }).boundingBox())!;
    expect(start.y + start.height).toBeLessThanOrEqual(375);
    await assignTeam(owner, 2, "t2");
    for (const page of pages) await expect(page.getByText("人数差あり", { exact: true })).toHaveCount(0);
    await pages[2]!.getByRole("button", { name: "ロビーに戻る", exact: true }).click();
    for (const page of pages.slice(0, 2)) await expect(page.getByRole("list", { name: "チーム編成" })).toHaveText("青チーム: 1人赤チーム: 1人");
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
