import { expect, test, type Page } from "@playwright/test";
import { createRoom, enterRooms, joinByCode, readyUp, waitForBattle } from "./roomFlow";
// 旧 world-network-tests/online.spec.ts。ロビーから固定8席の試験場へ入る導線は外れたので（33章）、部屋の対戦で同じ操作を確かめる。
test("room battle takes keyboard, touch and camera input from both players", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext({ locale: "ja-JP", viewport: { width: 1440, height: 900 } }), browser.newContext({ locale: "ja-JP", hasTouch: true, viewport: { width: 844, height: 390 } })]);
  const [desktop, mobile] = await Promise.all(contexts.map(c => c.newPage()));
  const pages = [desktop!, mobile!];
  const errors: string[] = [];
  try {
    for (const page of pages) { page.on("pageerror", e => errors.push(e.message)); await enterRooms(page); }
    await joinByCode(mobile!, await createRoom(desktop!));
    await readyUp(mobile!);
    await desktop!.getByRole("button", { name: "対戦開始", exact: true }).click();
    for (const page of pages) await waitForBattle(page);
    await expect(desktop!.getByRole("button", { name: "発射", exact: true })).toHaveCount(0);
    // ゲーム用のキー入力を検出するとタッチ操作は隠れるので、キーを押す前に確かめる。十字キーは36章のコンパクトな寸法（32px）。
    for (const label of ["左へ1歩", "右へ1歩", "発射"]) {
      const box = (await mobile!.getByRole("button", { name: label, exact: true }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(label === "発射" ? 44 : 32); expect(box.x + box.width).toBeLessThanOrEqual(844); expect(box.y + box.height).toBeLessThanOrEqual(390);
    }
    const enabled = (page: Page) => page.locator(".battle-weapons button").first().isEnabled();
    await expect.poll(async () => (await Promise.all(pages.map(enabled))).filter(Boolean).length).toBe(1);
    const actor = await enabled(desktop!) ? desktop! : mobile!, observer = actor === desktop ? mobile! : desktop!;
    const actorId = await actor.getByTestId("identity").innerText(), observerId = await observer.getByTestId("identity").innerText();
    const position = async () => JSON.parse(await observer.getByTestId("network-world").getAttribute("data-positions") ?? "[]").find((p: { playerId: string }) => p.playerId === actorId).x as number;
    const x = await position();
    await actor.keyboard.press("ArrowRight");
    await expect.poll(position).toBe(x + 1);
    await actor.keyboard.press("KeyE");
    await expect(actor.locator(".battle-weapons button").nth(1)).toHaveAttribute("aria-pressed", "true");
    await actor.keyboard.press("KeyQ");
    await expect(actor.locator(".battle-weapons button").nth(0)).toHaveAttribute("aria-pressed", "true");
    await actor.keyboard.press("Tab");
    await expect(actor.getByTestId("network-world")).toHaveAttribute("data-focus-player", observerId);
    await actor.keyboard.press("Tab");
    await expect(actor.getByTestId("network-world")).toHaveAttribute("data-focus-player", actorId);
    const angle = Number((await actor.getByTestId("camera-angle").textContent())!.replace("°", ""));
    await actor.keyboard.press("KeyW");
    await expect(actor.getByTestId("camera-angle")).toHaveText(`${angle + 1}°`);
    await actor.keyboard.press("KeyS");
    await expect(actor.getByTestId("camera-angle")).toHaveText(`${angle}°`);
    await actor.keyboard.down("Space"); await actor.waitForTimeout(400); await actor.keyboard.up("Space");
    await expect(observer.getByTestId("phase")).toHaveText("射撃を再生中");
    await expect(observer.getByTestId("phase")).toHaveText("操作中", { timeout: 10000 });
    await desktop!.screenshot({ path: "test-results/room-controls-desktop.png" });
    await mobile!.screenshot({ path: "test-results/room-controls-mobile.png" });
    const world = mobile!.getByTestId("network-world");
    const cameraX = Number(await world.getAttribute("data-camera-x"));
    await mobile!.mouse.move(440, 150); await mobile!.mouse.down(); await mobile!.mouse.move(cameraX > 250 ? 650 : 200, 150, { steps: 10 }); await mobile!.mouse.up();
    await expect(world).toHaveAttribute("data-mode", "manual");
    expect(Math.abs(Number(await world.getAttribute("data-camera-x")) - cameraX)).toBeGreaterThan(10);
    const cameraY = Number(await world.getAttribute("data-camera-y"));
    await world.hover({ position: { x: 420, y: 120 } });
    await mobile!.mouse.wheel(0, -60);
    await expect.poll(async () => Number(await world.getAttribute("data-camera-y"))).toBeLessThan(cameraY - 1);
    expect(errors).toEqual([]);
  } finally { for (const c of contexts) await c.close(); }
});
