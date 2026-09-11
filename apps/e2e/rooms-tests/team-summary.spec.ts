import { expect, test } from "@playwright/test";

test("all members see team counts update on reassignment and departure", async ({ browser, baseURL }, testInfo) => {
  const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext({ locale: "ja-JP", viewport: { width: 667, height: 375 } })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const page of pages) {
      await page.goto(`${baseURL}/?prototype=world`);
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await page.getByRole("button", { name: "オンライン対戦", exact: true }).click();
    }
    const owner = pages[0]!;
    await owner.getByRole("button", { name: "部屋を作る", exact: true }).click();
    await expect(owner.getByTestId("room-code")).toHaveText(/^[A-F0-9]{6}$/);
    const code = (await owner.getByTestId("room-code").textContent())!;
    for (const page of pages.slice(1)) {
      await page.getByLabel("部屋コード", { exact: true }).fill(code);
      await page.getByRole("button", { name: "部屋に参加", exact: true }).click();
      await expect(page.getByTestId("room-code")).toHaveText(code);
    }
    for (const [index, team] of ["t0", "t1", "t1"].entries()) await owner.getByLabel(`参加者${index + 1}のチーム`).selectOption(team);
    for (const page of pages) {
      await expect(page.getByRole("list", { name: "チーム編成" })).toHaveText("青チーム: 1人赤チーム: 2人");
      await expect(page.getByText("人数差あり", { exact: true })).toBeVisible();
    }
    await owner.locator(".room-team-summary").scrollIntoViewIfNeeded();
    await owner.screenshot({ path: testInfo.outputPath("team-counts.png") });
    const ready = (await owner.getByRole("button", { name: "準備完了", exact: true }).boundingBox())!;
    expect(ready.y + ready.height).toBeLessThanOrEqual(375);
    await owner.getByLabel("参加者3のチーム").selectOption("t2");
    for (const page of pages) await expect(page.getByText("人数差あり", { exact: true })).toHaveCount(0);
    await pages[2]!.getByRole("button", { name: "ロビーに戻る", exact: true }).click();
    for (const page of pages.slice(0, 2)) await expect(page.getByRole("list", { name: "チーム編成" })).toHaveText("青チーム: 1人赤チーム: 1人");
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
