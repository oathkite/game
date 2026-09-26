import { expect, test } from "@playwright/test";
import { lobby } from "../world-tests/practiceFlow";
test("invalid invitations show the reason without becoming ordinary disconnections", async ({ page }) => {
  let invitation: unknown;
  await page.route("**/v2/rooms/page*", route => route.fulfill({ json: { rooms: [{ roomId: "ABCDEF", mode: "custom", region: "asia", members: 1, spectators: 0, phase: "waiting", mapId: "moss-valley", updatedAt: 1 }], nextCursor: null } }));
  await page.routeWebSocket("**/v2/rooms/ABCDEF", ws => {
    ws.onMessage(value => {
      const input = JSON.parse(String(value)); invitation = input.invite;
      ws.send(JSON.stringify({ type: "room.error", reason: "invalid-invite" }));
    });
  });
  await page.goto("/?room=ABCDEF#invite=00000000-0000-4000-8000-000000000001");
  // 招待の部屋は部屋一覧から参加する。招待の token は参加の要求に添えて送る。
  await page.locator(".public-rooms li").filter({ hasText: "ABCDEF" }).getByRole("button", { name: "部屋に参加", exact: true }).click();
  await expect.poll(() => invitation).toBe("00000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("status").filter({ hasText: "招待リンクが無効か期限切れです。" })).toBeVisible();
  await page.getByRole("button", { name: "出撃準備", exact: true }).click();
  await expect(lobby(page)).toBeVisible();
});
