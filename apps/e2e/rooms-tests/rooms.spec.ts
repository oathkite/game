import { test, expect } from "@playwright/test";
test("room code, teams, ready, selected weapons and return to preparation", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext({ viewport: { width: 1440, height: 900 } }), browser.newContext({ hasTouch: true, viewport: { width: 844, height: 390 } })]);
  const [a, b] = await Promise.all(contexts.map(c => c.newPage()));
  const errors: string[] = [];
  try {
    for (const page of [a!, b!]) {
      page.on("pageerror", e => errors.push(e.message));
      await page.goto("/?prototype=world");
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await page.getByRole("button", { name: "オンライン試験" }).click();
    }
    await a!.getByRole("button", { name: "部屋を作る" }).click();
    const code = a!.getByTestId("room-code"); await expect(code).toHaveText(/^[A-F0-9]{6}$/);
    await b!.getByLabel("部屋コード", { exact: true }).fill((await code.textContent())!);
    await b!.getByRole("button", { name: "部屋に参加", exact: true }).click();
    await expect(a!.getByLabel("参加者2のチーム")).toBeVisible();
    const roomCode = await code.textContent();
    await b!.reload();
    await b!.getByRole("button", { name: "はじめる", exact: true }).click();
    await b!.getByRole("button", { name: "オンライン試験" }).click();
    await expect(b!.getByTestId("room-code")).toHaveText(roomCode!);
    await expect(b!.locator(".room-members li")).toHaveCount(2);
    await a!.getByLabel("参加者1のチーム").selectOption("t0");
    await expect(b!.getByLabel("参加者1のチーム")).toHaveValue("t0");
    await b!.getByLabel("参加者2のチーム").selectOption("t1");
    for (const page of [a!, b!]) {
      await page.getByLabel("部屋の装備1").selectOption("triple");
      await expect(page.getByLabel("部屋の装備1")).toHaveValue("triple");
    }
    await a!.getByRole("button", { name: "準備完了", exact: true }).click();
    await b!.getByLabel("部屋の装備2").selectOption("laser");
    await expect(a!.getByRole("button", { name: "準備完了", exact: true })).toBeVisible();
    await a!.getByRole("button", { name: "準備完了", exact: true }).click();
    await b!.getByRole("button", { name: "準備完了", exact: true }).click();
    await expect(a!.getByRole("button", { name: "対戦開始" })).toBeEnabled();
    await b!.screenshot({ path: "test-results/room-mobile.png" });
    await a!.getByRole("button", { name: "対戦開始" }).click();
    for (const page of [a!, b!]) await expect(page.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
    await expect(a!.getByRole("button", { name: "トリプル弾", exact: true })).toHaveAttribute("aria-pressed", "true");
    const shooter = await a!.getByRole("button", { name: "トリプル弾", exact: true }).isEnabled() ? a! : b!;
    if (shooter === a) { await shooter.keyboard.down("Space"); await shooter.waitForTimeout(400); await shooter.keyboard.up("Space"); } else { const fire = shooter.getByRole("button", { name: "発射", exact: true }); await fire.hover(); await shooter.mouse.down(); await shooter.waitForTimeout(400); await shooter.mouse.up(); }
    await expect(a!.getByTestId("phase")).toHaveText("射撃を再生中");
    await expect(a!.getByTestId("phase")).toHaveText("操作中", { timeout: 12000 });
    await b!.screenshot({ path: "test-results/room-battle-mobile.png" });
    await b!.setViewportSize({ width: 667, height: 375 });
    for (const name of ["左へ1歩", "右へ1歩", "発射"]) {
      const box = (await b!.getByRole("button", { name, exact: true }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44); expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(667); expect(box.y + box.height).toBeLessThanOrEqual(375);
    }
    await b!.getByRole("button", { name: "設定を開く" }).click();
    await b!.getByRole("button", { name: "降参", exact: true }).click();
    await expect(a!.getByRole("heading", { name: /チームの勝利/ })).toBeVisible();
    await a!.getByRole("button", { name: "部屋へ戻る（オーナー）", exact: true }).click();
    await expect(a!.getByTestId("room-code")).toHaveText((await code.textContent())!);
    await expect(b!.getByRole("button", { name: "準備完了", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { for (const c of contexts) await c.close(); }
});
