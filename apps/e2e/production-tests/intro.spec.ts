import { expect, test } from "@playwright/test";
test("intro skips, stays dismissed on revisit, and can replay from settings", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "スキップ", exact: true }).click();
  await expect(page.getByRole("button", { name: "スキップ", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "スキップ", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByRole("button", { name: "イントロを再生", exact: true }).click();
  await expect(page.getByRole("button", { name: "スキップ", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await expect(page.getByRole("heading", { name: "出発の準備" })).toBeVisible();
});
test("reduced motion and invitations bypass the intro", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "はじめる", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "スキップ", exact: true })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?room=ABCDEF");
  await expect(page.getByRole("textbox", { name: "部屋コード" })).toHaveValue("ABCDEF");
  await expect(page.getByRole("button", { name: "スキップ", exact: true })).toHaveCount(0);
});
test("intro finishes automatically even when storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) { if (key === "keropod.intro-seen") throw new Error("denied"); return get.call(this, key); };
    Storage.prototype.setItem = function (key, value) { if (key === "keropod.intro-seen") throw new Error("denied"); return set.call(this, key, value); };
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "スキップ", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "スキップ", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await expect(page.getByRole("heading", { name: "出発の準備" })).toBeVisible();
});
test("audio initialization refusal does not block starting the game", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { value: class { constructor() { throw new Error("audio unavailable"); } } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await expect(page.getByRole("heading", { name: "出発の準備" })).toBeVisible();
});
