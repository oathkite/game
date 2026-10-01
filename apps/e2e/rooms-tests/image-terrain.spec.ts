import { expect, test, type Page } from "@playwright/test";
import { control, createRoom, joinByCode, members, readyUp, teamOf } from "./roomFlow";
import type { LabFrame } from "@game/protocol/v2-lab";
// 地形を確実に削る弱い弾を撃つ。page.keyboard で 150 ms 押すと、CDP を通る分だけ押す時間が伸びてパワーが 20〜40 になり、
// 席と風によっては弾が地形に当たらずに抜けて、このテストが揺らいでいた。ページの中で 100 ms で離して、パワー 6 前後にする
const tapFire = (page: Page) => page.evaluate(() => new Promise<void>(resolve => {
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
  setTimeout(() => { window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" })); resolve(); }, 100);
}));
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
    await expect(control(shooter)).toHaveAttribute("data-control", "act");
    await tapFire(shooter);
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
    // 通常のカメラ倍率は displayScale.ts の loadCameraScale（8 px/セル、設計書 40.3）。
    const halfWidth = box.width / 8 / 2, halfHeight = box.height / 8 / 2;
    expect(Number(await field.getAttribute("data-initial-camera-x"))).toBeCloseTo(Math.max(halfWidth, Math.min(map.width - halfWidth, currentActor.x)), 2);
    expect(Number(await field.getAttribute("data-initial-camera-y"))).toBeCloseTo(Math.max(-100 + halfHeight, Math.min(map.height - halfHeight, currentActor.y - 6)), 2);
    await guest.screenshot({ path: `test-results/online-${mapId}-${test.info().project.name}.png` });
    expect(errors).toEqual([]);
  } finally { await Promise.allSettled(contexts.map(context => context.close())); }
});
