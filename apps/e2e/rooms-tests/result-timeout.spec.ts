import { expect, test } from "@playwright/test";

test("a disconnected participant cannot hold the result beyond its server deadline", async ({ browser }) => {
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ locale: "ja-JP", viewport: { width: 1440, height: 900 } })));
  const [owner, guest] = await Promise.all(contexts.map(context => context.newPage()));
  const errors: string[] = [];
  try {
    for (const [index, page] of [owner!, guest!].entries()) {
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("/");
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await page.getByRole("button", { name: "オンライン対戦", exact: true }).click();
      await page.getByLabel("対戦で使う名前").fill(`Return${index + 1}`);
    }
    await owner!.getByRole("button", { name: "部屋を作る", exact: true }).click();
    const code = (await owner!.getByTestId("room-code").textContent())!;
    await guest!.getByLabel("部屋コード", { exact: true }).fill(code);
    await guest!.getByRole("button", { name: "部屋に参加", exact: true }).click();
    await expect(owner!.locator(".room-members li")).toHaveCount(2);
    await owner!.getByLabel("参加者1のチーム").selectOption("t0");
    await owner!.getByLabel("参加者2のチーム").selectOption("t1");
    await expect(guest!.getByLabel("参加者2のチーム")).toHaveValue("t1");
    for (const page of [owner!, guest!]) await page.getByRole("button", { name: "準備完了", exact: true }).click();
    await owner!.getByRole("button", { name: "対戦開始", exact: true }).click();
    await expect(guest!.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
    await guest!.getByRole("button", { name: "設定を開く", exact: true }).click();
    await guest!.getByRole("button", { name: "降参", exact: true }).click();
    await expect(owner!.getByRole("heading", { name: /チームの勝利/ })).toBeVisible();
    const started = Date.now();
    await contexts[1]!.close();
    await expect(owner!.getByText(/部屋へ戻るまで \d+秒/)).toBeVisible();
    // Neither participant votes; real workerd alarm and browser clocks remain unmodified.
    await expect(owner!.getByTestId("room-code")).toHaveText(code, { timeout: 68000 });
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThan(55000);
    expect(elapsed).toBeLessThan(68000);
    await expect(owner!.getByRole("button", { name: "準備完了", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await test.info().attach("result-return-time.json", { body: JSON.stringify({ elapsedMs: elapsed }), contentType: "application/json" });
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
