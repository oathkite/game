import { expect, test } from "@playwright/test";
import { createRoom, joinByCode, members, readyUp, teamOf } from "./roomFlow";
import type { LabFrame } from "@game/protocol/v2-lab";
test("authored terrain is shared after firing and reconnecting", async ({ browser }) => {
  const mapId = String(test.info().project.metadata.mapId ?? "rock-arch");
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ locale: "ja-JP", viewport: { width: 1280, height: 800 } })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const frames: (LabFrame | undefined)[] = [], errors: string[] = [];
  try {
    for (const [i, page] of pages.entries()) {
      page.on("pageerror", error => errors.push(error.message));
      page.on("websocket", socket => socket.on("framereceived", event => {
        const frame = JSON.parse(String(event.payload));
        if (frame.type === "lab.frame") frames[i] = frame;
      }));
      await page.goto("/");
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await page.getByRole("radiogroup", { name:"車体色" }).getByRole("radio", { name:i === 0 ? "purple" : "cyan", exact:true }).click();
      await page.getByRole("radiogroup", { name:"砲塔色" }).getByRole("radio", { name:"orange", exact:true }).click();
      await page.getByLabel("名前", { exact: true }).fill(`Arch${i}`);
      await page.getByRole("button", { name: "出撃", exact: true }).click();
    }
    const owner = pages[0]!, guest = pages[1]!;
    await joinByCode(guest, await createRoom(owner));
    await expect(members(owner)).toHaveCount(2);
    await owner.getByLabel("マップ", { exact: true }).selectOption(mapId);
    await expect(guest.getByLabel("マップ", { exact: true })).toHaveValue(mapId);
    await expect(teamOf(guest, 1)).toHaveAccessibleName("赤チーム");
    await readyUp(guest);
    await owner.getByRole("button", { name: "対戦開始", exact: true }).click();
    for (const page of pages) await expect(page.getByTestId("network-world")).toHaveAttribute("data-loaded", "true", { timeout: 15000 });
    expect(frames[0]!.map.id).toBe(mapId);
    expect(frames[0]!.map.solidColumns).toHaveLength(frames[0]!.map.width);
    expect(frames[1]!.map).toEqual(frames[0]!.map);
    for (const frame of frames) expect(frame!.players.find(p => p.nickname === "Arch0")!.colors).toEqual({ primary:"purple", secondary:"orange" });
    await expect.poll(() => frames[0]!.opening ? Date.now() >= frames[0]!.opening!.endsAt : true, { timeout: 15000 }).toBe(true);
    const actor = frames[0]!.players.find(p => p.playerId === frames[0]!.actorId)!;
    const shooter = pages[Number(actor.nickname!.slice(-1))]!;
    await expect(shooter.locator(".battle-weapons button").first()).toBeEnabled();
    await shooter.keyboard.down("Space"); await shooter.waitForTimeout(150); await shooter.keyboard.up("Space");
    await expect.poll(() => frames[0]!.terrainOps.length, { timeout: 15000 }).toBeGreaterThan(0);
    await expect.poll(() => frames[0]!.phase, { timeout: 15000 }).toBe("acting");
    await expect.poll(() => frames[1]!.terrainOps).toEqual(frames[0]!.terrainOps);
    const map = frames[0]!.map, ops = frames[0]!.terrainOps;
    frames[1] = undefined;
    await guest.reload();
    await guest.getByRole("button", { name: "はじめる", exact: true }).click();
    await guest.evaluate(() => {
      const observer = new MutationObserver(() => {
        const field = document.querySelector<HTMLElement>('[data-testid="network-world"]');
        if (!field?.dataset.cameraX || !field.dataset.cameraY) return;
        field.dataset.initialCameraX = field.dataset.cameraX;
        field.dataset.initialCameraY = field.dataset.cameraY;
        observer.disconnect();
      });
      observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-camera-x", "data-camera-y"] });
    });
    await guest.getByRole("button", { name: "出撃", exact: true }).click();
    await expect(guest.getByTestId("network-world")).toHaveAttribute("data-loaded", "true", { timeout: 15000 });
    expect(frames[1]!.players.find(p => p.nickname === "Arch0")!.colors).toEqual({ primary:"purple", secondary:"orange" });
    expect(frames[1]!.map).toEqual(map); expect(frames[1]!.terrainOps).toEqual(ops);
    const field = guest.getByTestId("network-world");
    await expect(field).toHaveAttribute("data-initial-camera-x", /[\d.]+/);
    const box = (await field.boundingBox())!;
    const currentActor = frames[1]!.players.find(p => p.playerId === frames[1]!.actorId)!;
    // 通常のカメラ倍率は displayScale.ts の loadCameraScale（9 * 7 / 9）。
    const halfWidth = box.width / 7 / 2, halfHeight = box.height / 7 / 2;
    expect(Number(await field.getAttribute("data-initial-camera-x"))).toBeCloseTo(Math.max(halfWidth, Math.min(map.width - halfWidth, currentActor.x)), 2);
    expect(Number(await field.getAttribute("data-initial-camera-y"))).toBeCloseTo(Math.max(-100 + halfHeight, Math.min(map.height - halfHeight, currentActor.y - 6)), 2);
    await guest.screenshot({ path: `test-results/online-${mapId}-${test.info().project.name}.png` });
    expect(errors).toEqual([]);
  } finally { await Promise.allSettled(contexts.map(context => context.close())); }
});
