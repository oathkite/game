import { expect, test } from "@playwright/test";
for (const count of [2, 4]) {
test(`quick ${count === 2 ? "1v1" : "2v2"} assigns balanced teams and starts when everyone is ready`, async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: count }, () => browser.newContext({ locale: "ja-JP", viewport: { width: 1440, height: 900 } })));
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  try {
    for (const page of pages) {
      await page.goto("/?prototype=world");
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await page.getByRole("button", { name: "オンライン対戦" }).click();
      await page.getByLabel("クイック対戦形式").selectOption(count === 2 ? "1v1" : "2v2");
      await page.getByLabel("クイック対戦地域").selectOption("asia");
      await page.getByRole("button", { name: "クイック参加", exact: true }).click();
      await expect(page.getByTestId("room-code")).toBeVisible();
    }
    const code = await pages[0]!.getByTestId("room-code").textContent();
    for (const page of pages) {
      await expect(page.getByTestId("room-code")).toHaveText(code!);
      await expect(page.getByLabel("参加者1のチーム")).toBeDisabled();
      await page.getByRole("button", { name: "準備完了", exact: true }).click();
    }
    for (const page of pages) await expect(page.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
    const players = JSON.parse((await pages[0]!.getByTestId("network-world").getAttribute("data-positions"))!);
    expect(players).toHaveLength(count);
    expect(players.filter((p: { teamId: string }) => p.teamId === "t0")).toHaveLength(count / 2);
  } finally { for (const context of contexts) await context.close(); }
});
}
test("a waiting player gets the 30-second choices and can cancel", async ({ page }) => {
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "オンライン対戦" }).click();
  await page.getByLabel("クイック対戦地域").selectOption("americas");
  await page.getByRole("button", { name: "クイック参加", exact: true }).click();
  await expect(page.getByTestId("room-code")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("対戦相手を待っています", { timeout: 33000 });
  await page.getByRole("button", { name: "待機をキャンセル" }).click();
  await expect(page.getByTestId("room-code")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "クイック参加", exact: true })).toBeEnabled();
});
