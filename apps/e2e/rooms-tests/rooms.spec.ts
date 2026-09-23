import { test, expect } from "@playwright/test";
import { assignTeam, chooseWeapon, createRoom, enterRooms, joinByCode, members, readyUp, teamOf, waitForBattle } from "./roomFlow";
test("room code, teams, ready, selected weapons and return to preparation", async ({ browser }) => {
  test.setTimeout(150000);
  const contexts = await Promise.all([browser.newContext({ locale: "ja-JP", viewport: { width: 1440, height: 900 } }), browser.newContext({ locale: "ja-JP", hasTouch: true, viewport: { width: 844, height: 390 } })]);
  const [a, b] = await Promise.all(contexts.map(c => c.newPage()));
  const errors: string[] = [], winds: (number | undefined)[] = [];
  try {
    for (const [index, page] of [a!, b!].entries()) {
      page.on("websocket", socket => socket.on("framereceived", ({ payload }) => {
        const message = JSON.parse(String(payload));
        if (message.type === "lab.frame") winds[index] = message.wind;
      }));
      await page.addInitScript(() => {
        const NativeSocket = WebSocket;
        window.WebSocket = class extends NativeSocket {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            (window as unknown as { gameSockets?: WebSocket[] }).gameSockets ??= [];
            (window as unknown as { gameSockets: WebSocket[] }).gameSockets.push(this);
          }
        };
        const start = OscillatorNode.prototype.start;
        OscillatorNode.prototype.start = function (when?: number) {
          const target = window as unknown as { playedTones?: number[] };
          (target.playedTones ??= []).push(this.frequency.value);
          start.call(this, when);
        };
      });
      page.on("pageerror", e => errors.push(e.message));
      await enterRooms(page);
    }
    const roomCode = await createRoom(a!);
    await joinByCode(b!, roomCode);
    await expect(members(a!)).toHaveCount(2);
    await members(a!).nth(0).locator(".room-team-current").getByRole("button", { name: "変更", exact: true }).click();
    const swatches = a!.getByRole("dialog", { name: "チーム" }).locator(".room-team-swatches button");
    await expect(swatches.first()).toHaveAccessibleName("青チーム");
    await expect(swatches.last()).toHaveAccessibleName("銀チーム");
    await a!.keyboard.press("Escape");
    await b!.reload();
    await b!.getByRole("button", { name: "はじめる", exact: true }).click();
    await b!.getByRole("button", { name: "出撃", exact: true }).click();
    await expect(b!.getByTestId("room-code")).toHaveText(roomCode);
    await expect(members(b!)).toHaveCount(2);
    await assignTeam(b!, 1, "t2");
    await expect(teamOf(a!, 1)).toHaveAccessibleName("緑チーム");
    await assignTeam(a!, 1, "t1");
    await expect(teamOf(b!, 1)).toHaveAccessibleName("赤チーム");
    for (const page of [a!, b!]) await chooseWeapon(page, 0, "トリプル弾");
    await readyUp(b!);
    await expect(a!.getByRole("button", { name: "対戦開始", exact: true })).toBeEnabled();
    // マップと装備の変更は全員の準備完了を解除する。オーナー以外はマップを選べない。
    await expect(b!.getByLabel("マップ", { exact: true })).toBeDisabled();
    await a!.getByLabel("マップ", { exact: true }).selectOption("reed-hills");
    await expect(b!.getByLabel("マップ", { exact: true })).toHaveValue("reed-hills");
    await expect(b!.getByRole("button", { name: "準備完了", exact: true })).toBeVisible();
    await expect(a!.getByRole("button", { name: "対戦開始", exact: true })).toBeDisabled();
    await readyUp(b!);
    await chooseWeapon(b!, 1, "レーザー弾");
    await expect(b!.getByRole("button", { name: "準備完了", exact: true })).toBeVisible();
    await readyUp(b!);
    await expect(a!.getByRole("button", { name: "対戦開始", exact: true })).toBeEnabled();
    await b!.screenshot({ path: "test-results/room-mobile.png" });
    await a!.getByRole("button", { name: "対戦開始", exact: true }).click();
    for (const page of [a!, b!]) await waitForBattle(page);
    // 風は canvas に描かれるので、両者が受け取った値を比べる。
    expect(winds[0]).toEqual(expect.any(Number));
    expect(winds[1]).toBe(winds[0]);
    await expect(a!.getByRole("button", { name: "トリプル弾", exact: true })).toHaveAttribute("aria-pressed", "true");
    const shooter = await a!.getByRole("button", { name: "トリプル弾", exact: true }).isEnabled() ? a! : b!;
    if (shooter === a) { await shooter.keyboard.down("Space"); await shooter.waitForTimeout(400); await shooter.keyboard.up("Space"); } else { const fire = shooter.getByRole("button", { name: "発射", exact: true }); await fire.hover(); await shooter.mouse.down(); await shooter.waitForTimeout(400); await shooter.mouse.up(); }
    await expect(a!.getByTestId("phase")).toHaveText("射撃を再生中");
    await expect(a!.getByTestId("phase")).toHaveText("操作中", { timeout: 12000 });
    await expect.poll(() => shooter.evaluate(() => (window as unknown as { playedTones?: number[] }).playedTones?.length ?? 0)).toBeGreaterThan(0);
    await b!.screenshot({ path: "test-results/room-battle-mobile.png" });
    await b!.setViewportSize({ width: 667, height: 375 });
    for (const name of ["左へ1歩", "右へ1歩", "発射"]) {
      const box = (await b!.getByRole("button", { name, exact: true }).boundingBox())!;
      // 十字キーは36章のコンパクトな寸法（32px）。発射は44px以上。
      expect(box.height).toBeGreaterThanOrEqual(name === "発射" ? 44 : 32); expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(667); expect(box.y + box.height).toBeLessThanOrEqual(375);
    }
    const identity = await b!.getByTestId("identity").textContent();
    await b!.evaluate(() => {
      const sockets = (window as unknown as { gameSockets: WebSocket[] }).gameSockets.filter(socket => socket.readyState === WebSocket.OPEN && socket.url.includes("/v2/rooms/"));
      if (sockets.length !== 1) throw new Error(`Expected one live room connection: ${sockets.map(s => s.url)}`);
      sockets[0]!.close();
    });
    await expect(b!.getByRole("button", { name: "再接続", exact: true })).toBeVisible();
    await expect(b!.getByTestId("network-world")).toBeVisible();
    await b!.getByRole("button", { name: "再接続", exact: true }).click();
    await expect(b!.getByTestId("network-world")).toBeVisible();
    await expect(b!.getByRole("button", { name: "再接続", exact: true })).toHaveCount(0);
    await expect(b!.getByTestId("identity")).toHaveText(identity!);
    await b!.getByRole("button", { name: "設定を開く" }).click();
    await b!.getByText("試合の診断情報", { exact: true }).click();
    const diagnostics = JSON.parse(await b!.getByRole("textbox", { name: "試合の診断情報", exact: true }).inputValue());
    expect(diagnostics.format).toBe("keropod-match-diagnostics-v1");
    expect(diagnostics.matchId).toBeTruthy();
    expect(diagnostics.build.map.id).toBe("reed-hills");
    expect(JSON.stringify(diagnostics)).not.toContain((await b!.evaluate(() => sessionStorage.getItem("keropod.room-token")))!);
    await b!.getByRole("button", { name: "降参", exact: true }).click();
    await expect(a!.getByRole("heading", { name: "勝利", exact: true })).toBeVisible();
    await a!.getByRole("button", { name: "部屋に戻る", exact: true }).click();
    // 全員がそろった瞬間に部屋へ戻り、対戦画面の破棄（PixiJS の WebGL loseContext）がヘッドレス Chromium で数秒から数十秒止まる。
    // 最後のクリックの後に待たず、戻った画面の確認に余裕を持たせる。この停止は不具合として別に追っている。
    await b!.getByRole("button", { name: "部屋に戻る", exact: true }).click({ noWaitAfter: true });
    await expect(a!.getByTestId("room-code")).toHaveText(roomCode, { timeout: 90000 });
    await expect(b!.getByRole("button", { name: "準備完了", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { for (const c of contexts) await c.close(); }
});
