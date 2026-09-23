import { expect, test } from "@playwright/test";
import { createRoom, enterRooms, joinByCode, members, readyUp, teamOf } from "./roomFlow";

test("a disconnected participant cannot hold the result beyond its server deadline", async ({ browser }) => {
  test.setTimeout(180000);
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ locale: "ja-JP", viewport: { width: 1440, height: 900 } })));
  const [owner, guest] = await Promise.all(contexts.map(context => context.newPage()));
  const errors: string[] = [];
  let returnedAt = 0;
  owner!.on("websocket", socket => socket.on("framereceived", ({ payload }) => {
    const message = JSON.parse(String(payload));
    if (message.type === "room.snapshot" && message.room.phase === "waiting") returnedAt = Date.now();
  }));
  try {
    for (const [index, page] of [owner!, guest!].entries()) {
      page.on("pageerror", error => errors.push(error.message));
      await enterRooms(page, `Return${index + 1}`);
    }
    const code = await createRoom(owner!);
    await joinByCode(guest!, code);
    await expect(members(owner!)).toHaveCount(2);
    await expect(teamOf(guest!, 1)).toHaveAccessibleName("赤チーム");
    await readyUp(guest!);
    await owner!.getByRole("button", { name: "対戦開始", exact: true }).click();
    await expect(guest!.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
    await guest!.getByRole("button", { name: "設定を開く", exact: true }).click();
    await guest!.getByRole("button", { name: "降参", exact: true }).click();
    await expect(owner!.getByRole("heading", { name: "勝利", exact: true })).toBeVisible();
    const started = Date.now();
    returnedAt = 0;
    await contexts[1]!.close();
    await expect(owner!.getByText(/部屋へ戻るまで \d+秒/)).toBeVisible();
    // Neither participant votes; real workerd alarm and browser clocks remain unmodified.
    // サーバーの期限は受信した snapshot の時刻で測る。画面の切り替えは、対戦画面の破棄（PixiJS の WebGL loseContext）が
    // ヘッドレス Chromium で数十秒止まることがあるので分けて待つ。この停止は不具合として別に追っている。
    await expect.poll(() => returnedAt, { timeout: 68000, intervals: [250] }).toBeGreaterThan(0);
    const elapsed = returnedAt - started;
    expect(elapsed).toBeGreaterThan(55000);
    expect(elapsed).toBeLessThan(68000);
    await expect(owner!.getByTestId("room-code")).toHaveText(code, { timeout: 90000 });
    await expect(owner!.getByRole("button", { name: "対戦開始", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await test.info().attach("result-return-time.json", { body: JSON.stringify({ elapsedMs: elapsed }), contentType: "application/json" });
  } finally { await Promise.allSettled(contexts.map(context => context.close())); }
});
