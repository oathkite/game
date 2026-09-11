import { expect, test } from "@playwright/test";
test("invalid invitations show the reason without becoming ordinary disconnections", async ({ page }) => {
  let invitation: unknown;
  await page.routeWebSocket("**/v2/rooms/ABCDEF", ws => {
    ws.onMessage(value => {
      const input = JSON.parse(String(value)); invitation = input.invite;
      ws.send(JSON.stringify({ type: "room.error", reason: "invalid-invite" }));
    });
  });
  await page.goto("/?room=ABCDEF#invite=00000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "部屋に参加", exact: true }).click();
  await expect.poll(() => invitation).toBe("00000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("status").filter({ hasText: "招待リンクが無効か期限切れです。" })).toBeVisible();
  await page.getByRole("button", { name: "ロビーに戻る", exact: true }).click();
  await expect(page.getByRole("button", { name: "オンライン対戦", exact: true })).toBeVisible();
});
