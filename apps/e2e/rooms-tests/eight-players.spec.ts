import { expect, test } from "@playwright/test";

test("eight independent players complete a 4v4 match and return together", async ({ browser }) => {
  test.setTimeout(180000);
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
    // Cold loading eight renderers can span a turn; start input checks early in a live turn.
    await expect.poll(async () => Number(await owner.locator(".countdown-dial > span").innerText()), { timeout: 25000 }).toBeGreaterThanOrEqual(18);
    const nextSeat = owner.locator(".battle-seat").filter({ has: owner.getByLabel("1人後の手番", { exact: true }) });
    const nextName = await nextSeat.locator("strong").textContent();
    const nextPage = pages[Number(nextName!.replace("Pilot", "")) - 1]!;
    await nextPage.getByRole("button", { name: "設定を開く", exact: true }).click();
    await expect(nextPage.getByRole("dialog", { name: "対戦設定" })).toBeVisible();
    await expect(nextPage.getByText("あなたの手番です", { exact: true })).toHaveCount(0);
    const actors = await Promise.all(pages.map(page => page.locator(".battle-weapons button").first().isEnabled()));
    expect(actors.filter(Boolean)).toHaveLength(1);
    const shooter = pages[actors.indexOf(true)]!;
    const ring = () => shooter.locator(".countdown-dial").evaluate(node => ({
      seconds: Number(node.querySelector("span")!.textContent),
      arc: Number(node.querySelectorAll("circle")[1]!.getAttribute("stroke-dasharray")!.split(" ")[0]),
    }));
    const beforeShot = await ring();
    expect(beforeShot.seconds).toBeGreaterThan(0);
    expect(beforeShot.arc).toBe(beforeShot.seconds * 5);
    await shooter.keyboard.down("Space"); await shooter.waitForTimeout(400); await shooter.keyboard.up("Space");
    await Promise.all(pages.map(page => expect(page.getByTestId("phase")).toHaveText("射撃を再生中")));
    await Promise.all(pages.map(async page => {
      await expect(page.locator(".countdown-dial > span")).toHaveText("—");
      await expect(page.locator(".countdown-dial circle").nth(1)).toHaveAttribute("stroke-dasharray", "0 100");
    }));
    await Promise.all(pages.map(page => expect(page.getByTestId("phase")).toHaveText("操作中", { timeout: 15000 })));
    await expect.poll(async () => (await ring()).arc).toBeGreaterThan(0);
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
    const resultTables = await Promise.all(pages.map(async page => {
      await expect(page.locator('.battle-result-player[data-reaction="win"]')).toHaveCount(4);
      await expect(page.locator('.battle-result-player[data-reaction="lose"]')).toHaveCount(4);
      const table = page.getByRole("table", { name: "試合成績" });
      await expect(table.locator("tbody tr")).toHaveCount(8);
      return table.locator("tbody").innerText();
    }));
    expect(new Set(resultTables).size).toBe(1);
    const shotCounts = await owner.getByRole("table", { name: "試合成績" }).locator("tbody tr td:first-of-type").allTextContents();
    expect(shotCounts.reduce((sum, value) => sum + Number(value), 0)).toBe(1);
    await owner.screenshot({ path: "test-results/eight-player-result.png" });
    await owner.setViewportSize({ width: 667, height: 375 });
    const resultPanel = owner.locator(".network-finished");
    const panelBox = (await resultPanel.boundingBox())!;
    expect(panelBox.y).toBe(0);
    expect(panelBox.height).toBe(375);
    await expect(owner.locator(".battle-roster")).toBeHidden();
    await expect(owner.locator(".battle-console")).toBeHidden();
    const portraits = owner.locator(".battle-result-player");
    const positions = await portraits.evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect(); return { x: Math.round(rect.x), y: Math.round(rect.y), right: rect.right };
    }));
    expect(new Set(positions.map(position => position.x)).size).toBe(4);
    expect(new Set(positions.map(position => position.y)).size).toBe(2);
    expect(positions.every(position => position.x >= 0 && position.right <= 667)).toBe(true);
    await portraits.first().scrollIntoViewIfNeeded();
    await owner.screenshot({ path: "test-results/eight-player-result-mobile.png" });
    const returnButton = owner.getByRole("button", { name: "部屋へ戻る", exact: true });
    await returnButton.scrollIntoViewIfNeeded();
    const returnBox = (await returnButton.boundingBox())!;
    expect(returnBox.y).toBeGreaterThanOrEqual(0);
    expect(returnBox.y + returnBox.height).toBeLessThanOrEqual(375);
    await owner.screenshot({ path: "test-results/eight-player-result-mobile-actions.png" });
    await owner.setViewportSize({ width: 390, height: 844 });
    await expect(owner.locator(".network-portrait")).toBeHidden();
    await returnButton.scrollIntoViewIfNeeded();
    const portraitReturn = (await returnButton.boundingBox())!;
    expect(portraitReturn.y + portraitReturn.height).toBeLessThanOrEqual(844);
    await owner.screenshot({ path: "test-results/eight-player-result-portrait.png" });
    await owner.setViewportSize({ width: 1440, height: 900 });
    for (const page of pages.slice(0, -1)) {
      await page.getByRole("button", { name: "部屋へ戻る", exact: true }).click();
      await expect(page.getByRole("button", { name: "帰還待ち", exact: true })).toBeDisabled();
    }
    await pages[7]!.getByRole("button", { name: "部屋へ戻る", exact: true }).click();
    for (const page of pages) {
      await expect(page.getByTestId("room-code")).toHaveText(code!);
      await expect(page.locator(".room-members li")).toHaveCount(8);
      await expect(page.getByRole("button", { name: "準備完了", exact: true })).toBeVisible();
    }
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
