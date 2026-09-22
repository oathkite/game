import { expect, test, type Page } from "@playwright/test";

test("プラクティス入口、未解放ステージ、自由練習、横画面の射撃", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await page.getByRole("button", { name: "ターゲットチャレンジ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ターゲットチャレンジ", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "02 丘の向こう 未解放" })).toBeDisabled();
  await page.screenshot({ path: "test-results/practice-desktop.png" });
  await page.getByRole("button", { name: "プラクティスへ戻る" }).click();
  await page.getByRole("button", { name: "自由練習", exact: true }).click();
  await page.getByRole("button", { name: "自由練習をはじめる" }).click();
  await expect(page.locator(".kp-canvas canvas")).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await page.getByRole("button", { name: "ターゲットチャレンジ", exact: true }).click();
  await page.getByRole("button", { name: "ステージ1をはじめる" }).click();
  await expect(page.locator(".kp-canvas canvas")).toBeVisible();
  await page.screenshot({ path: "test-results/challenge-desktop.png" });
  await page.getByRole("button", { name: "設定を開く", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "もう一度", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: "test-results/challenge-mobile.png" });
  await page.getByRole("button", { name: "設定を開く", exact: true }).click();
  await page.getByRole("button", { name: "ステージ選択へ戻る" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "ステージ1をはじめる" })).toBeInViewport();
  await page.screenshot({ path: "test-results/practice-mobile.png" });
});


// 実入力の長押し時間を偽の時計で固定し、マシン負荷によるパワーのずれを避ける。
const fireAtPower = async (page: Page, power: number) => {
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
  await page.keyboard.down("Space");
  await page.clock.runFor(power * 15 + 3);
  await page.keyboard.up("Space");
  await page.clock.resume();
};

import { SOLUTIONS } from "../../client/test/fixtures/challenge-solutions";

test("実操作で全8面をクリアし、解放・BESTを再読み込み後も保持する", async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await page.getByRole("button", { name: "ターゲットチャレンジ", exact: true }).click();
  await page.getByRole("button", { name: "ステージ1をはじめる" }).click();
  for (const [index, actions] of SOLUTIONS.entries()) {
    await expect(page.locator(".kp-canvas canvas")).toBeVisible();
    let elevation = 45;
    for (const action of actions) {
      await expect(page.getByRole("button", { name: "発射", exact: true })).toBeEnabled();
      for (let i = 0; i < action.move; i++) await page.keyboard.press("ArrowRight");
      for (let i = 0; i < Math.abs(action.elevation - elevation); i++) await page.keyboard.press(action.elevation > elevation ? "ArrowUp" : "ArrowDown");
      elevation = action.elevation;
      await page.keyboard.press(action.slot === 0 ? "KeyQ" : "KeyE");
      await fireAtPower(page, action.power);
      await expect(page.getByRole("button", { name: "発射", exact: true })).toBeDisabled();
      if (action !== actions[actions.length - 1]) await expect(page.getByRole("button", { name: "発射", exact: true })).toBeEnabled({ timeout: 20000 });
    }
    await expect(page.getByRole("heading", { name: "CLEAR!", exact: true })).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: `test-results/challenge-clear-${index + 1}.png` });
    if (index < 7) await page.getByRole("button", { name: "次のステージへ" }).click();
  }
  await expect(page.getByText("全8ステージクリア！ 次は最少弾数に挑戦しよう。")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await page.getByRole("button", { name: "ターゲットチャレンジ", exact: true }).click();
  await expect(page.getByText("8 / 8 CLEAR", { exact: true })).toBeVisible();
  await expect(page.locator(".practice-card.cleared")).toHaveCount(8);
});

test("弾切れ後に再挑戦でき、メニューを開くと長押し射撃を取り消す", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await page.getByRole("button", { name: "ターゲットチャレンジ", exact: true }).click();
  await page.getByRole("button", { name: "ステージ1をはじめる" }).click();
  await expect(page.locator(".kp-canvas canvas")).toBeVisible();
  await page.keyboard.down("Space");
  await page.keyboard.press("Escape");
  await page.keyboard.up("Space");
  await page.getByRole("button", { name: "練習に戻る" }).click();
  await expect(page.locator(".challenge-status")).toContainText("残り 5発");
  for (let i = 0; i < 5; i++) {
    await expect(page.getByRole("button", { name: "発射", exact: true })).toBeEnabled({ timeout: 20000 });
    await page.keyboard.press("Space");
    await expect(page.locator(".challenge-status")).toContainText(`残り ${4 - i}発`);
  }
  await expect(page.getByRole("heading", { name: "もう一度挑戦しよう" })).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "もう一度", exact: true }).click();
  await expect(page.locator(".challenge-status")).toContainText("的 1 · 残り 5発");
  await expect(page.getByRole("button", { name: "発射", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "設定を開く", exact: true }).click();
  await page.getByRole("button", { name: "ステージ選択へ戻る" }).click();
  await expect(page.getByRole("button", { name: "02 丘の向こう 未解放" })).toBeDisabled();
});


test("縦画面で操作でき、ブラウザの戻るは練習メニューを開く", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await page.getByRole("button", { name: "ターゲットチャレンジ", exact: true }).click();
  await page.getByRole("button", { name: "プラクティスへ戻る" }).click();
  await page.getByRole("button", { name: "自由練習", exact: true }).click();
  await page.goBack();
  await page.getByRole("button", { name: "ターゲットチャレンジ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ターゲットチャレンジ" })).toBeVisible();
  await page.getByRole("button", { name: "ステージ1をはじめる" }).click();
  await expect(page.getByRole("button", { name: "発射", exact: true })).toBeEnabled();
  for (const label of ["発射", "左へ移動", "右へ移動", "角度を上げる", "角度を下げる", "設定を開く"]) {
    const box = (await page.getByRole("button", { name: label, exact: true }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
  }
  await page.screenshot({ path: "test-results/challenge-portrait.png" });
  await page.goBack();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "練習に戻る" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".challenge-status")).toContainText("残り 5発");
});

test("英語設定を練習の一覧・説明・操作にも引き継ぐ", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("keropod.language", "en"));
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Target Challenge", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Target Challenge" })).toBeVisible();
  await expect(page.getByRole("button", { name: "02 Over the hill Locked" })).toBeDisabled();
  await page.getByRole("button", { name: "Start stage 1" }).click();
  await expect(page.locator(".challenge-status")).toContainText("Targets 1 · Shots left 5");
  await expect(page.locator(".challenge-hint")).toContainText("Hold Fire");
});
