import { expect, test } from "@playwright/test";
// 地域の自動選択と「クイック参加」は、e984b39 の部屋一覧の改修で画面から外れた（TBD-29）。
// 入口を戻すか廃止するかが決まるまで保留する。rooms-tests/quick.spec.ts と同じ扱い。
test.fixme(true, "クイック参加の入口と地域別の応答表示が画面に無い（設計書32章・36章との食い違い、TBD-29）");
const enter = async (page: import("@playwright/test").Page) => {
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "出撃", exact: true }).click();
};
test("selects the fastest measured region but preserves a manual choice", async ({ page }) => {
  await page.route("**/v2/regions/*/probe?*", async route => {
    const url = new URL(route.request().url()), region = url.pathname.split("/")[3]!;
    await new Promise(resolve => setTimeout(resolve, region === "europe" ? 10 : region === "asia" ? 150 : 100));
    await route.fulfill({ json: { region, mode: url.searchParams.get("mode") } });
  });
  await enter(page);
  const select = page.getByLabel("クイック対戦地域");
  await expect(select).toHaveValue("europe");
  await expect(page.getByRole("status").filter({ hasText: "地域別の応答" })).toContainText("ms");
  await select.selectOption("americas");
  await page.getByLabel("クイック対戦形式").selectOption("2v2");
  await expect(page.getByRole("status").filter({ hasText: "地域別の応答" })).toBeVisible();
  await expect(select).toHaveValue("americas");
  let sent: unknown;
  await page.route("**/v2/quick", async route => { sent = route.request().postDataJSON(); await route.fulfill({ status: 503, body: "offline" }); });
  await page.getByRole("button", { name: "クイック参加", exact: true }).click();
  await expect.poll(() => sent).toEqual({ mode: "2v2", region: "americas" });
});
test("does not select a region when all probes fail", async ({ page }) => {
  await page.route("**/v2/regions/*/probe?*", route => route.fulfill({ status: 503, body: "offline" }));
  await enter(page);
  await expect(page.getByText("地域を測定できません。手動で選択してください。", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "クイック参加", exact: true })).toBeDisabled();
  await page.getByLabel("クイック対戦地域").selectOption("asia");
  await expect(page.getByRole("button", { name: "クイック参加", exact: true })).toBeEnabled();
});
