import { expect, test } from "@playwright/test";
test("new world lobby connects two players to the sprite camera battlefield", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext({ viewport: { width: 1440, height: 900 } }), browser.newContext({ viewport: { width: 844, height: 390 } })]);
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  const errors: string[] = [];
  try {
    for (const page of pages) {
      page.on("pageerror", e => errors.push(e.message));
      await page.goto("/?prototype=world");
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await page.getByRole("button", { name: "オンライン試験" }).click();
      await page.getByRole("button", { name: "固定8席試験" }).click();
      await expect(page.getByTestId("identity")).toHaveText(/^p\d$/);
      await expect(page.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
    }
    const [a, b] = pages, id = await a!.getByTestId("identity").innerText();
    const position = async () => JSON.parse(await b!.getByTestId("network-world").getAttribute("data-positions") ?? "[]").find((p: { playerId: string }) => p.playerId === id).x as number;
    const x = await position();
    await a!.getByRole("button", { name: "右へ1歩" }).click();
    await expect.poll(position).toBe(x + 1);
    await a!.getByRole("button", { name: "発射", exact: true }).click();
    await expect(b!.getByTestId("phase")).toHaveText("射撃を再生中");
    await expect(b!.getByTestId("phase")).toHaveText("操作中", { timeout: 10000 });
    await a!.screenshot({ path: "test-results/world-online-desktop.png" });
    await b!.screenshot({ path: "test-results/world-online-mobile.png" });
    for (const label of ["左へ1歩", "右へ1歩", "発射"]) {
      const box = (await b!.getByRole("button", { name: label, exact: true }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44); expect(box.x + box.width).toBeLessThanOrEqual(844); expect(box.y + box.height).toBeLessThanOrEqual(390);
    }
    const world = b!.getByTestId("network-world");
    const cameraX = Number(await world.getAttribute("data-camera-x"));
    await b!.mouse.move(440, 150); await b!.mouse.down(); await b!.mouse.move(cameraX > 250 ? 650 : 200, 150, { steps: 10 }); await b!.mouse.up();
    await expect(world).toHaveAttribute("data-mode", "manual");
    expect(Math.abs(Number(await world.getAttribute("data-camera-x")) - cameraX)).toBeGreaterThan(10);
    await b!.getByRole("button", { name: "手番へ戻る" }).click();
    await expect(world).toHaveAttribute("data-mode", "actor");
    expect(errors).toEqual([]);
  } finally { for (const c of contexts) await c.close(); }
});
