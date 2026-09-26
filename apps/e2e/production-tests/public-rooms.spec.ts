import { expect, test } from "@playwright/test";
const room = (roomId: string, phase = "waiting", members = 1) => ({ roomId, mode: "custom", region: "asia", members, spectators: 0, phase, mapId: "moss-valley", updatedAt: 1 });
test("public rooms paginate, recover from failure and respect admission state", async ({ page }) => {
  let fail = true;
  await page.route("**/v2/rooms/page*", route => {
    if (fail) { fail = false; return route.fulfill({ status: 503 }); }
    const after = new URL(route.request().url()).searchParams.get("after");
    return route.fulfill({ json: after ? { rooms: [room("CCCCCC", "waiting", 8)], nextCursor: null } : { rooms: [room("AAAAAA"), room("BBBBBB", "started")], nextCursor: "1:BBBBBB" } });
  });
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "出撃", exact: true }).click();
  // 部屋一覧はロビーに直接出る。取得に失敗しても、3秒ごとの自動更新で回復する。
  await expect(page.getByRole("alert")).toContainText("部屋一覧を取得できませんでした");
  await expect(page.locator(".public-rooms li")).toHaveCount(2, { timeout: 10000 });
  await expect(page.locator(".public-rooms li").filter({ hasText: "BBBBBB" }).getByRole("button", { name: "部屋に参加", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "もっと見る", exact: true }).click();
  await expect(page.locator(".public-rooms li")).toHaveCount(3);
  await expect(page.locator(".public-rooms li").filter({ hasText: "CCCCCC" }).getByRole("button", { name: "部屋に参加", exact: true })).toBeDisabled();
});
