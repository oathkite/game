import { expect, test } from "@playwright/test";
test("a public room can be found and joined without entering its code", async ({ browser, baseURL }, testInfo) => {
  const contexts = await Promise.all([browser.newContext({ locale: "ja-JP" }), browser.newContext({ locale: "ja-JP", viewport: { width: 390, height: 844 } }), browser.newContext({ locale: "ja-JP" })]);
  const [owner, guest, spectator] = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const page of [owner!, guest!]) {
      await page.goto(`${baseURL}/?prototype=world`);
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await page.getByRole("button", { name: "オンライン対戦", exact: true }).click();
    }
    await owner!.getByRole("button", { name: "部屋を作る", exact: true }).click();
    await expect(owner!.getByTestId("room-code")).toHaveText(/^[A-F0-9]{6}$/);
    const code = (await owner!.getByTestId("room-code").textContent())!;
    await guest!.getByRole("button", { name: "公開部屋を探す", exact: true }).click();
    await expect(guest!.locator(".public-rooms")).toBeVisible();
    await expect(guest!.locator(".public-rooms [role=status]")).toHaveCount(0);
    const card = guest!.locator(".public-rooms li").filter({ hasText: code });
    for (let i = 0; i < 6 && await card.count() === 0 && await guest!.getByRole("button", { name: "もっと見る", exact: true }).count(); i++) {
      await guest!.getByRole("button", { name: "もっと見る", exact: true }).click();
      await expect(guest!.locator(".public-rooms [role=status]")).toHaveCount(0);
    }
    await expect(card).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    await guest!.screenshot({ path: testInfo.outputPath("public-rooms.png") });
    await card.getByRole("button", { name: "部屋に参加", exact: true }).click();
    await expect(guest!.getByTestId("room-code")).toHaveText(code);
    await expect(guest!.getByRole("status").filter({ hasText: "入室前の応答" })).toContainText(/\d+ ms/);
    await expect(owner!.locator(".room-members li")).toHaveCount(2);
    await owner!.getByLabel("参加者1のチーム").selectOption("t0");
    await guest!.getByLabel("参加者2のチーム").selectOption("t1");
    await owner!.getByRole("button", { name: "準備完了", exact: true }).click();
    await guest!.getByRole("button", { name: "準備完了", exact: true }).click();
    await owner!.getByRole("button", { name: "対戦開始", exact: true }).click();
    await expect(owner!.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
    await spectator!.goto(`${baseURL}/?prototype=world`);
    await spectator!.getByRole("button", { name: "はじめる", exact: true }).click();
    await spectator!.getByRole("button", { name: "オンライン対戦", exact: true }).click();
    await spectator!.getByRole("button", { name: "公開部屋を探す", exact: true }).click();
    const started = spectator!.locator(".public-rooms li").filter({ hasText: code });
    await expect(started).toContainText("対戦中");
    await expect(started.getByRole("button", { name: "部屋に参加", exact: true })).toHaveCount(0);
    await started.getByRole("button", { name: "観戦する", exact: true }).click();
    await expect(spectator!.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
    await expect(spectator!.getByRole("status").filter({ hasText: "観戦中" })).toBeVisible();
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
