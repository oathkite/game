import { expect, test } from "@playwright/test";
import type { LabFrame } from "@game/protocol/v2-lab";

test("resizing cancels held fire and rotation restores fresh touch input", async ({ browser }) => {
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ locale: "ja-JP", viewport: { width: 844, height: 390 }, hasTouch: true })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const frames: (LabFrame | undefined)[] = [], shots: number[] = [0, 0];
  try {
    for (const [i, page] of pages.entries()) {
      page.on("websocket", socket => {
        socket.on("framereceived", event => {
          const frame = JSON.parse(String(event.payload));
          if (frame.type === "lab.frame") frames[i] = frame;
        });
        socket.on("framesent", event => {
          if (JSON.parse(String(event.payload)).type === "turn.fire") shots[i] = shots[i]! + 1;
        });
      });
      await page.goto("/");
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await page.getByRole("button", { name: "出撃", exact: true }).click();
      await page.getByLabel("対戦で使う名前").fill(`Rotate${i}`);
    }
    const [owner, guest] = pages;
    await owner!.getByRole("button", { name: "部屋を作る", exact: true }).click();
    await expect(owner!.getByTestId("room-code")).toHaveText(/^[A-F0-9]{6}$/);
    await guest!.getByLabel("部屋コード", { exact: true }).fill((await owner!.getByTestId("room-code").textContent())!);
    await guest!.getByRole("button", { name: "部屋に参加", exact: true }).click();
    await expect(owner!.locator(".room-members li")).toHaveCount(2);
    await owner!.getByLabel("参加者1のチーム").selectOption("t0");
    await expect(guest!.getByLabel("参加者1のチーム")).toHaveValue("t0");
    await guest!.getByLabel("参加者2のチーム").selectOption("t1");
    await expect(owner!.getByLabel("参加者2のチーム")).toHaveValue("t1");
    for (const page of pages) await page.getByRole("button", { name: "準備完了", exact: true }).click();
    await owner!.getByRole("button", { name: "対戦開始", exact: true }).click();
    await expect.poll(() => frames[0]?.opening ? Date.now() >= frames[0]!.opening!.endsAt : false, { timeout: 15000 }).toBe(true);
    const actor = frames[0]!.players.find(player => player.playerId === frames[0]!.actorId)!;
    const index = Number(actor.nickname!.slice(-1)), page = pages[index]!;
    const fire = page.getByRole("button", { name: "発射", exact: true });
    await expect(fire).toBeEnabled();
    const power = page.getByRole("meter", { name: "パワー", exact: true });
    await fire.hover();
    await page.mouse.down();
    await expect.poll(async () => Number(await power.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
    await page.setViewportSize({ width: 800, height: 400 });
    await expect(power).toHaveAttribute("aria-valuenow", "0");
    await page.mouse.up();
    expect(shots[index]).toBe(0);
    await fire.hover();
    await page.mouse.down();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "横向きでプレイしよう", exact: true })).toBeVisible();
    await expect(fire).toBeDisabled();
    await page.mouse.up();
    expect(shots[index]).toBe(0);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(fire).toBeEnabled();
    const reserve = page.getByRole("meter", { name: "残り移動", exact: true });
    await expect(reserve).toHaveAttribute("aria-valuenow", "30");
    await page.getByRole("button", { name: "右へ1歩", exact: true }).tap();
    await expect(reserve).toHaveAttribute("aria-valuenow", "29");
    await expect.poll(() => frames[index]?.movement.stepsLeft).toBe(29);
    await expect(pages[1 - index]!.getByRole("meter", { name: "残り移動", exact: true })).toHaveAttribute("aria-valuenow", "0");
    await fire.tap();
    await expect.poll(() => shots[index]).toBe(1);
    await expect.poll(() => frames[index]?.phase).toBe("replaying");
  } finally { await Promise.allSettled(contexts.map(context => context.close())); }
});
