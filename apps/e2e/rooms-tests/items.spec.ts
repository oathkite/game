import { expect, test, type Page } from "@playwright/test";
import { canAct, control, createRoom, enterRooms, joinByCode, readyUp, waitForBattle } from "./roomFlow";

// アイテム（設計書 42）。相手の手番には選べず、テレポートで撃った側が移り、使ったアイテムは使用済みになる。
// 着地点は風で変わるので、x の値そのものは比べない。
const item = (page: Page, name: string) => page.locator(".battle-items").getByRole("button", { name: new RegExp(`^${name}`) });
const positionOf = async (page: Page, playerId: string) =>
  JSON.parse(await page.getByTestId("network-world").getAttribute("data-positions") ?? "[]").find((p: { playerId: string }) => p.playerId === playerId) as { x: number; y: number };

test("online battle uses each item once and teleports the shooter", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext({ locale: "ja-JP", viewport: { width: 1440, height: 900 } }), browser.newContext({ locale: "ja-JP", hasTouch: true, viewport: { width: 844, height: 390 } })]);
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  const errors: string[] = [];
  try {
    for (const page of pages) { page.on("pageerror", e => errors.push(e.message)); await enterRooms(page); }
    await joinByCode(pages[1]!, await createRoom(pages[0]!));
    await readyUp(pages[1]!);
    await pages[0]!.getByRole("button", { name: "対戦開始", exact: true }).click();
    for (const page of pages) await waitForBattle(page);
    // キーを押す前に撮る。タッチの画面はキー入力を検出するとタッチの操作盤を隠す
    await pages[1]!.screenshot({ path: "test-results/items-touch.png" });
    await expect.poll(async () => (await Promise.all(pages.map(canAct))).filter(Boolean).length).toBe(1);
    const actor = await canAct(pages[0]!) ? pages[0]! : pages[1]!, observer = actor === pages[0] ? pages[1]! : pages[0]!;
    const actorId = await actor.getByTestId("identity").innerText();

    // アイテムは武器の真上に、武器と同じ幅で並ぶ。タッチの画面では発射のボタンに重ならない
    for (const page of pages) {
      const weapons = await page.locator(".battle-weapons > button").evaluateAll(buttons => buttons.map(b => b.getBoundingClientRect().toJSON() as DOMRect));
      const fireButton = page.getByRole("button", { name: "発射", exact: true });
      const fire = await fireButton.count() ? await fireButton.boundingBox() : null;
      for (const [i, name] of ["ダブルシュート", "テレポート"].entries()) {
        const box = (await item(page, name).boundingBox())!, weapon = weapons[i]!;
        expect(Math.abs(box.x - weapon.x)).toBeLessThanOrEqual(1); expect(Math.abs(box.width - weapon.width)).toBeLessThanOrEqual(1);
        expect(box.y + box.height).toBeLessThanOrEqual(weapon.y);
        if (fire) expect(weapon.y + weapon.height).toBeLessThanOrEqual(fire.y);
      }
    }
    // 相手の手番の準備では、角度と武器は変えられてもアイテムは選べない（42.1）
    await expect(control(observer)).toHaveAttribute("data-control", "prepare");
    await expect(item(observer, "テレポート")).toBeDisabled();
    await expect(item(observer, "ダブルシュート")).toBeDisabled();

    await item(actor, "テレポート").click();
    await expect(item(actor, "テレポート")).toHaveAttribute("aria-pressed", "true");
    // 押し直せば外せる
    await item(actor, "テレポート").click();
    await expect(item(actor, "テレポート")).toHaveAttribute("aria-pressed", "false");
    await item(actor, "テレポート").click();

    // 手番は右向きで始まる（TBD-44）。右側の機体がそのまま撃つと弾がマップの外へ消えて移れないので、相手の方へ 1 歩向ける
    const observerId = await observer.getByTestId("identity").innerText();
    const start = await positionOf(observer, actorId), target = await positionOf(observer, observerId);
    await actor.keyboard.press(target.x < start.x ? "ArrowLeft" : "ArrowRight");
    await expect.poll(async () => (await positionOf(observer, actorId)).x).not.toBe(start.x);
    const before = await positionOf(observer, actorId);
    await actor.keyboard.down("Space"); await actor.waitForTimeout(400); await actor.keyboard.up("Space");
    await expect(observer.getByTestId("phase")).toHaveText("射撃を再生中");
    await expect(observer.getByTestId("phase")).toHaveText("操作中", { timeout: 15000 });
    const after = await positionOf(observer, actorId);
    expect(after.x !== before.x || after.y !== before.y).toBe(true);

    // 使ったアイテムは使用済みになり、もう一方は残る。選択は手番をまたがない
    await expect(item(actor, "テレポート（使用済み）")).toBeDisabled();
    await expect(item(actor, "テレポート")).toHaveAttribute("aria-pressed", "false");
    await expect(item(actor, "ダブルシュート")).toHaveAttribute("aria-pressed", "false");
    await expect(control(observer)).toHaveAttribute("data-control", "act");
    await expect(item(observer, "ダブルシュート")).toBeEnabled();
    await expect(item(observer, "テレポート")).toBeEnabled();
    await pages[0]!.screenshot({ path: "test-results/items-desktop.png" });
    await pages[1]!.screenshot({ path: "test-results/items-mobile.png" });
    expect(errors).toEqual([]);
  } finally { for (const c of contexts) await c.close(); }
});
