import { cpuSituationSchema } from "@game/protocol/cpu";
import { expect, test } from "@playwright/test";

test("Jevの戦術を取得して敵が射撃し、通信失敗時も進行する", async ({ page }, info) => {
  test.skip(!info.config.configFile?.endsWith("jev.config.ts"), "専用のJev接続先を使うconfigで実行");
  test.setTimeout(90000);
  await page.addInitScript(() => { Math.random = () => 0.25; });
  const bodies: string[] = [];
  await page.route("**/cpu/decision", async route => {
    bodies.push(route.request().postData() ?? "");
    if (bodies.length > 1) await route.fulfill({ status: 503, body: "unavailable" });
    else await route.fulfill({ json: { movement: "hold", weapon: "cannon", trajectory: "lob", pace: "careful" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await page.getByRole("button", { name: "CPU戦", exact: true }).click();
  await page.getByRole("button", { name: "CPU戦をはじめる" }).click();
  await expect.poll(() => bodies.length, { timeout: 20000 }).toBe(1);
  expect(cpuSituationSchema.safeParse(JSON.parse(bodies[0]!)).success).toBe(true);
  expect(JSON.parse(bodies[0]!)).toMatchObject({ level: "normal", self: { hp: 100 } });
  expect(bodies[0]).not.toContain("nickname");
  await expect.poll(() => page.evaluate(() => {
    const view = window.__fortress?.getView();
    return view?.currentSeat === 1 && view.phase === "replaying";
  }), { timeout: 30000, intervals: [50] }).toBe(true);
  await page.getByRole("button", { name: "設定を開く", exact: true }).click();
  await page.getByRole("button", { name: "降参して対戦を終える" }).click();
  await page.getByRole("button", { name: "もう一度プレイ" }).click();
  await expect.poll(() => bodies.length, { timeout: 20000 }).toBe(2);
  await expect.poll(() => page.evaluate(() => {
    const view = window.__fortress?.getView();
    return view?.currentSeat === 1 && view.phase === "replaying";
  }), { timeout: 30000, intervals: [50] }).toBe(true);
  expect(await page.evaluate(() => window.__fortress?.getView().mismatches)).toBe(0);
});
