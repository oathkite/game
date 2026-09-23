import { assertRosterReadable, turnOrder } from "./rosterReadability";
import { expect, test } from "@playwright/test";
import { assignTeam, createRoom, enterRooms, joinByCode, members, readyUp, teamLabel, teamOf, waitForBattle } from "./roomFlow";

test("eight independent players complete a 4v4 match and return together", async ({ browser }) => {
  test.setTimeout(180000);
  const contexts = await Promise.all(Array.from({ length: 8 }, () => browser.newContext({ locale: "ja-JP", viewport: { width: 1440, height: 900 } })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const errors: string[] = [];
  try {
    await Promise.all(pages.map(async (page, index) => {
      page.on("pageerror", error => errors.push(error.message));
      await enterRooms(page, `Pilot${index + 1}`);
    }));
    const owner = pages[0]!;
    const code = await createRoom(owner);
    // Serial admission keeps the seat order explicit; each player has isolated storage and a socket.
    for (const page of pages.slice(1)) await joinByCode(page, code);
    await expect(members(owner)).toHaveCount(8);
    const mapId = test.info().project.metadata.mapId;
    if (typeof mapId === "string") {
      await owner.getByLabel("マップ", { exact: true }).selectOption(mapId);
      await expect(pages[7]!.getByLabel("マップ", { exact: true })).toHaveValue(mapId);
    }
    for (let index = 1; index < 8; index++) {
      await assignTeam(owner, index, index < 4 ? "t0" : "t1");
      await expect(teamOf(pages[7]!, index)).toHaveAccessibleName(teamLabel(index < 4 ? "t0" : "t1"));
    }
    for (const page of pages.slice(1)) await readyUp(page);
    await expect(owner.getByRole("button", { name: "対戦開始", exact: true })).toBeEnabled();
    await owner.getByRole("button", { name: "対戦開始", exact: true }).click();
    for (const page of pages) {
      await expect(page.getByTestId("network-world")).toHaveAttribute("data-loaded", "true", { timeout: 20000 });
      await expect(turnOrder(page)).toHaveCount(8);
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
    await assertRosterReadable(owner);
    for (const width of [844, 667]) {
      await owner.setViewportSize({ width, height: 390 });
      await assertRosterReadable(owner);
      await owner.screenshot({ path: `test-results/eight-player-hud-${width}.png` });
    }
    await owner.setViewportSize({ width: 1440, height: 900 });
    for (const page of pages) await waitForBattle(page);
    // Cold loading eight renderers can span a turn; start input checks early in a live turn.
    await expect.poll(async () => Number(await owner.locator(".countdown-dial > span").innerText()), { timeout: 25000 }).toBeGreaterThanOrEqual(18);
    await expect.poll(async () => (await Promise.all(pages.map(page => page.locator(".battle-weapons button").first().isEnabled()))).filter(Boolean), { timeout: 15000 }).toHaveLength(1);
    // 全員の最初の予約は同じ時刻なので、射撃した人の次の予約は2番目の人より後になる。
    const nextName = await turnOrder(owner).nth(1).locator(".turn-order-player").textContent();
    const nextPage = pages[Number(nextName!.replace("Pilot", "")) - 1]!;
    await nextPage.getByRole("button", { name: "設定を開く", exact: true }).click();
    await expect(nextPage.getByRole("dialog", { name: "対戦設定" })).toBeVisible();
    await expect(nextPage.getByText("あなたの手番です", { exact: true })).toHaveCount(0);
    const actors = await Promise.all(pages.map(page => page.locator(".battle-weapons button").first().isEnabled()));
    expect(actors.filter(Boolean)).toHaveLength(1);
    const shooter = pages[actors.indexOf(true)]!;
    // 残り時間は数字だけで示す（63dc954 で輪を外した）。
    const seconds = async () => Number(await shooter.locator(".countdown-dial > span").innerText());
    expect(await seconds()).toBeGreaterThan(0);
    // Observe the transient replay state atomically, before firing, in every context.
    const replayChecks = pages.map(page => page.waitForFunction(() =>
      document.querySelector('[data-testid="phase"]')?.textContent === "射撃を再生中" &&
      document.querySelector(".countdown-dial > span")?.textContent === "—",
    undefined, { polling: 50, timeout: 15000 }));
    await shooter.keyboard.down("Space"); await shooter.waitForTimeout(400); await shooter.keyboard.up("Space");
    const replayHandles = await Promise.all(replayChecks);
    await Promise.all(replayHandles.map(handle => handle.dispose()));
    await Promise.all(pages.map(page => expect(page.getByTestId("phase")).toHaveText("操作中", { timeout: 15000 })));
    await expect.poll(seconds).toBeGreaterThan(0);
    await expect(turnOrder(owner).and(owner.locator('[aria-current="true"]')).locator(".turn-order-player")).toHaveText(nextName!);
    await expect(nextPage.getByRole("dialog", { name: "対戦設定" })).toBeVisible();
    await expect(nextPage.getByRole("status").filter({ hasText: "あなたの手番です" })).toBeVisible();
    await nextPage.getByRole("dialog", { name: "対戦設定" }).getByRole("button", { name: "閉じる", exact: true }).click();
    await owner.screenshot({ path: "test-results/eight-player-battle.png" });
    for (const page of pages.slice(0, 4)) {
      await page.getByRole("button", { name: "設定を開く", exact: true }).click();
      await page.getByRole("button", { name: "降参", exact: true }).click();
    }
    for (const [index, page] of pages.entries()) await expect(page.getByRole("heading", { name: index < 4 ? "敗北" : "勝利", exact: true })).toBeVisible();
    const resultTables = await Promise.all(pages.map(async page => {
      const table = page.getByRole("table", { name: "試合成績" });
      // 成績の数字はカウントアップするので、段階表示が終わってから読む。
      await expect(page.locator(".result-table-scroll")).toHaveAttribute("data-motion", "done", { timeout: 15000 });
      await expect(table.locator('tbody tr[data-reaction="win"]')).toHaveCount(4);
      await expect(table.locator('tbody tr[data-reaction="lose"]')).toHaveCount(4);
      await expect(table.locator("tbody tr")).toHaveCount(8);
      return table.locator("tbody").innerText();
    }));
    expect(new Set(resultTables).size).toBe(1);
    // 列はチーム、結果、発射数の順。
    const shotCounts = await owner.getByRole("table", { name: "試合成績" }).locator("tbody tr td:nth-of-type(3)").allTextContents();
    expect(shotCounts.reduce((sum, value) => sum + Number(value), 0)).toBe(1);
    await owner.screenshot({ path: "test-results/eight-player-result.png" });
    await owner.setViewportSize({ width: 667, height: 375 });
    const resultPanel = owner.locator(".network-finished");
    const panelBox = (await resultPanel.boundingBox())!;
    expect(panelBox.y).toBe(0);
    expect(panelBox.height).toBe(375);
    // 手番順リストが結果画面に重なる不具合は result-overlay.spec.ts で追う。
    await expect(owner.locator(".battle-console")).toBeHidden();
    // 成績は表で並べる。表は横に収まらなければ枠の中でスクロールする。
    const rows = owner.getByRole("table", { name: "試合成績" }).locator("tbody tr");
    const scroller = (await owner.locator(".result-table-scroll").boundingBox())!;
    expect(scroller.x).toBeGreaterThanOrEqual(0);
    expect(scroller.x + scroller.width).toBeLessThanOrEqual(667);
    await rows.first().scrollIntoViewIfNeeded();
    await owner.screenshot({ path: "test-results/eight-player-result-mobile.png" });
    const returnButton = owner.getByRole("button", { name: "部屋に戻る", exact: true });
    await returnButton.scrollIntoViewIfNeeded();
    const returnBox = (await returnButton.boundingBox())!;
    expect(returnBox.y).toBeGreaterThanOrEqual(0);
    expect(returnBox.y + returnBox.height).toBeLessThanOrEqual(375);
    await owner.screenshot({ path: "test-results/eight-player-result-mobile-actions.png" });
    await owner.setViewportSize({ width: 390, height: 844 });
    await returnButton.scrollIntoViewIfNeeded();
    const portraitReturn = (await returnButton.boundingBox())!;
    expect(portraitReturn.y + portraitReturn.height).toBeLessThanOrEqual(844);
    await owner.screenshot({ path: "test-results/eight-player-result-portrait.png" });
    await owner.setViewportSize({ width: 1440, height: 900 });
    await Promise.all(pages.slice(0, -1).map(async page => {
      await page.getByRole("button", { name: "部屋に戻る", exact: true }).click();
      await expect(page.getByRole("button", { name: "帰還待ち", exact: true })).toBeDisabled();
    }));
    // 全員がそろった瞬間に部屋へ戻り、対戦画面の破棄（PixiJS の WebGL loseContext）がヘッドレス Chromium で数秒から数十秒止まる。
    // 最後のクリックの後に待たず、戻った画面の確認に余裕を持たせる。この停止は不具合として別に追っている。
    await pages[7]!.getByRole("button", { name: "部屋に戻る", exact: true }).click({ noWaitAfter: true });
    await Promise.all(pages.map(async page => {
      await expect(page.getByTestId("room-code")).toHaveText(code, { timeout: 90000 });
      await expect(members(page)).toHaveCount(8);
      await expect(page.getByRole("button", { name: page === owner ? "対戦開始" : "準備完了", exact: true })).toBeVisible();
    }));
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
