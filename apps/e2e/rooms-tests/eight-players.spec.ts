import { expect, test } from "@playwright/test";

test("eight independent players complete a 4v4 match and return together", async ({ browser }) => {
  test.setTimeout(120000);
  const contexts = await Promise.all(Array.from({ length: 8 }, () => browser.newContext({ locale: "ja-JP", viewport: { width: 1440, height: 900 } })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const errors: string[] = [];
  try {
    await Promise.all(pages.map(async (page, index) => {
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("/");
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await page.getByRole("button", { name: "オンライン対戦", exact: true }).click();
      await page.getByLabel("対戦で使う名前").fill(`Pilot${index + 1}`);
    }));
    const owner = pages[0]!;
    await owner.getByRole("button", { name: "部屋を作る", exact: true }).click();
    const code = await owner.getByTestId("room-code").textContent();
    expect(code).toMatch(/^[A-F0-9]{6}$/);
    // Serial admission keeps the seat order explicit; each player has isolated storage and a socket.
    for (const page of pages.slice(1)) {
      await page.getByLabel("部屋コード", { exact: true }).fill(code!);
      await page.getByRole("button", { name: "部屋に参加", exact: true }).click();
      await expect(page.getByTestId("room-code")).toHaveText(code!);
    }
    await expect(owner.locator(".room-members li")).toHaveCount(8);
    for (let index = 0; index < 8; index++) {
      await owner.getByLabel(`参加者${index + 1}のチーム`).selectOption(index < 4 ? "t0" : "t1");
      await expect(pages[7]!.getByLabel(`参加者${index + 1}のチーム`)).toHaveValue(index < 4 ? "t0" : "t1");
    }
    for (const page of pages) await page.getByRole("button", { name: "準備完了", exact: true }).click();
    await expect(owner.getByRole("button", { name: "対戦開始", exact: true })).toBeEnabled();
    await owner.getByRole("button", { name: "対戦開始", exact: true }).click();
    for (const page of pages) {
      await expect(page.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
      await expect(page.locator(".battle-seat")).toHaveCount(8);
    }
    if (test.info().project.metadata.measureTransfer) {
      const bytes = await Promise.all(pages.map(async page => {
        await page.waitForLoadState("networkidle");
        return page.evaluate(() => [...performance.getEntriesByType("navigation"), ...performance.getEntriesByType("resource")].reduce((total, entry) => total + (entry as PerformanceResourceTiming).encodedBodySize, 0));
      }));
      console.info(`Eight-player cumulative encoded transfer: ${JSON.stringify(bytes)}`);
      for (const value of bytes) { expect(value).toBeGreaterThan(0); expect(value).toBeLessThanOrEqual(8_000_000); }
      await test.info().attach("eight-player-transfer.json", { body: JSON.stringify(bytes), contentType: "application/json" });
    }
    const portrait = owner.locator(".battle-seat-portrait").first();
    const portraitBox = (await portrait.boundingBox())!;
    const imageBox = (await portrait.locator("img").boundingBox())!;
    expect(imageBox.y).toBeGreaterThanOrEqual(portraitBox.y);
    expect(imageBox.y + imageBox.height).toBeLessThanOrEqual(portraitBox.y + portraitBox.height + 1);
    await expect(owner.locator(".battle-upcoming")).toHaveCount(3);
    const nextSeat = owner.locator(".battle-seat").filter({ has: owner.getByLabel("1人後の手番", { exact: true }) });
    const nextName = await nextSeat.locator("strong").textContent();
    const nextPage = pages[Number(nextName!.replace("Pilot", "")) - 1]!;
    await nextPage.getByRole("button", { name: "設定を開く", exact: true }).click();
    await expect(nextPage.getByRole("dialog", { name: "対戦設定" })).toBeVisible();
    await expect(nextPage.getByText("あなたの手番です", { exact: true })).toHaveCount(0);
    const actors = await Promise.all(pages.map(page => page.locator(".battle-weapons button").first().isEnabled()));
    expect(actors.filter(Boolean)).toHaveLength(1);
    const shooter = pages[actors.indexOf(true)]!;
    await shooter.keyboard.down("Space"); await shooter.waitForTimeout(400); await shooter.keyboard.up("Space");
    await Promise.all(pages.map(page => expect(page.getByTestId("phase")).toHaveText("射撃を再生中")));
    await Promise.all(pages.map(page => expect(page.getByTestId("phase")).toHaveText("操作中", { timeout: 15000 })));
    await expect(owner.locator(".battle-seat.is-actor strong")).toHaveText(nextName!);
    await expect(nextPage.getByRole("dialog", { name: "対戦設定" })).toBeVisible();
    await expect(nextPage.getByRole("status").filter({ hasText: "あなたの手番です" })).toBeVisible();
    await nextPage.getByRole("button", { name: "対戦に戻る", exact: true }).click();
    await owner.screenshot({ path: "test-results/eight-player-battle.png" });
    for (const page of pages.slice(0, 4)) {
      await page.getByRole("button", { name: "設定を開く", exact: true }).click();
      await page.getByRole("button", { name: "降参", exact: true }).click();
    }
    for (const page of pages) await expect(page.getByRole("heading", { name: /赤チームの勝利/ })).toBeVisible();
    await owner.getByRole("button", { name: "部屋へ戻る（オーナー）", exact: true }).click();
    for (const page of pages) {
      await expect(page.getByTestId("room-code")).toHaveText(code!);
      await expect(page.locator(".room-members li")).toHaveCount(8);
      await expect(page.getByRole("button", { name: "準備完了", exact: true })).toBeVisible();
    }
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
