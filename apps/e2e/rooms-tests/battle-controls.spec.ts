import { expect, test, type Page } from "@playwright/test";
import { canAct, control, createRoom, enterRooms, joinByCode, readyUp, waitForBattle } from "./roomFlow";
// 風のメーター（8.5）。両者に同じサーバーの風を出す。ターンの切り替わりをまたいで読まないよう、揃うまで読み直す。
const windLabels = (pages: readonly Page[]) => Promise.all(pages.map(page => page.locator(".battle-console > .battle-wind .battle-sr").textContent()));
const expectSameWind = async (pages: readonly Page[]): Promise<void> => {
  await expect.poll(async () => { const [a, b] = await windLabels(pages); return a === b && /^(左向きの風 \d+|右向きの風 \d+|無風)$/.test(a ?? ""); }).toBe(true);
};
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
    await expectSameWind(pages);
    await expect(desktop!.getByRole("button", { name: "発射", exact: true })).toHaveCount(0);
    // ゲーム用のキー入力を検出するとタッチ操作は隠れるので、キーを押す前に確かめる。十字キーは36章のコンパクトな寸法（32px）。
    for (const label of ["左へ1歩", "右へ1歩", "発射"]) {
      const box = (await mobile!.getByRole("button", { name: label, exact: true }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(label === "発射" ? 44 : 32); expect(box.x + box.width).toBeLessThanOrEqual(844); expect(box.y + box.height).toBeLessThanOrEqual(390);
    }
    await expect.poll(async () => (await Promise.all(pages.map(canAct))).filter(Boolean).length).toBe(1);
    const actor = await canAct(desktop!) ? desktop! : mobile!, observer = actor === desktop ? mobile! : desktop!;
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
    // 相手の手番でも、次の自分の手番へ向けて武器と角度だけは変えられる（設計書 30 章）。移動はできない
    await expect(control(observer)).toHaveAttribute("data-control", "prepare");
    if (observer === mobile) {
      await expect(mobile!.getByRole("button", { name: "角度を上げる", exact: true })).toBeEnabled();
      for (const label of ["右へ1歩", "発射"]) await expect(mobile!.getByRole("button", { name: label, exact: true })).toBeDisabled();
    }
    const prepared = Number((await observer.getByTestId("camera-angle").textContent())!.replace("°", ""));
    await observer.keyboard.press("KeyE");
    await expect(observer.locator(".battle-weapons button").nth(1)).toHaveAttribute("aria-pressed", "true");
    await observer.keyboard.press("KeyW");
    await expect(observer.getByTestId("camera-angle")).toHaveText(`${prepared + 1}°`);
    const observerX = async () => JSON.parse(await actor.getByTestId("network-world").getAttribute("data-positions") ?? "[]").find((p: { playerId: string }) => p.playerId === observerId).x as number;
    const before = await observerX();
    await observer.keyboard.down("ArrowRight"); await observer.waitForTimeout(300); await observer.keyboard.up("ArrowRight");
    expect(await observerX()).toBe(before);
    await actor.keyboard.down("Space"); await actor.waitForTimeout(400); await actor.keyboard.up("Space");
    await expect(observer.getByTestId("phase")).toHaveText("射撃を再生中");
    await expect(control(observer)).toHaveAttribute("data-control", "prepare");
    await expect(observer.getByTestId("phase")).toHaveText("操作中", { timeout: 10000 });
    // 準備した武器と角度は、次の自分の手番へ引き継ぐ
    await expect(control(observer)).toHaveAttribute("data-control", "act");
    await expect(observer.locator(".battle-weapons button").nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(observer.getByTestId("camera-angle")).toHaveText(`${prepared + 1}°`);
    await expectSameWind(pages);
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
