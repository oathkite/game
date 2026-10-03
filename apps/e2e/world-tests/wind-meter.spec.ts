import { expect, test, type Locator, type Page } from "@playwright/test";
import { enterFreePractice } from "./practiceFlow";

// 風のメーター（設計書 08 の 8.5）。操作盤を 2 段にし、角度メーターの真下に矢印と数値で今の風を、パワーの真下に残り移動を出す。
// 操作盤の高さは変えない。ただしスマートフォンの縦持ちは 2026-10-02 に、パワーと残り移動を盤の全幅の段に分けて 216px に高くした（30 章）。風の値は開発用のフック（window.__fortress）で読むので、dev サーバーで確かめる。
// 対戦の起動は重いので、タッチの有無ごとに 1 回だけ起動し、画面の大きさは setViewportSize で切り替える。

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
type Size = { readonly name: string; readonly viewport: { readonly width: number; readonly height: number }; readonly panel: number; readonly half: { readonly width: number; readonly height: number }; readonly stacked?: boolean };
const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const box = async (locator: Locator): Promise<Box> => (await locator.boundingBox())!;

// panel は操作盤の高さ（変えていないことを確かめる）、half はメーターの片側の大きさ（20 × 7 art px を 2 または 3 CSS px で描く）
const withoutTouch: readonly Size[] = [
  { name: "desktop", viewport: { width: 1280, height: 800 }, panel: 160, half: { width: 60, height: 21 } },
  { name: "laptop", viewport: { width: 1100, height: 650 }, panel: 120, half: { width: 40, height: 14 } },
  { name: "narrow-desktop", viewport: { width: 960, height: 600 }, panel: 96, half: { width: 40, height: 14 } },
];
const withTouch: readonly Size[] = [
  { name: "landscape-phone", viewport: { width: 844, height: 390 }, panel: 112, half: { width: 40, height: 14 } },
  { name: "portrait-phone", viewport: { width: 390, height: 844 }, panel: 216, half: { width: 40, height: 14 }, stacked: true },
  { name: "narrow-portrait-phone", viewport: { width: 360, height: 800 }, panel: 216, half: { width: 40, height: 14 }, stacked: true },
];

const meterOf = (page: Page) => page.locator(".battle-console > .battle-wind");

const openPractice = async (page: Page): Promise<void> => {
  await page.goto("/?prototype=world");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await enterFreePractice(page);
  // 1 ターン目の風は開始時のマップ紹介の後に決まる。それまでは無風と誤って見せないよう「—」を出し、段組みは変えない。
  await expect.poll(() => page.evaluate(() => {
    const meter = document.querySelector(".battle-console > .battle-wind");
    return { turn: window.__fortress!.getView().turnNumber, label: meter?.querySelector(".battle-sr")?.textContent, number: meter?.querySelector("b")?.textContent };
  })).toEqual({ turn: 0, label: "風は未定", number: "—" });
  await expect(page.getByTestId("camera-world")).toHaveAttribute("data-opening", "false", { timeout: 15000 });
};

/** 画面のメーターと store の風を同じ瞬間に読む。ターンの切り替わりで風が変わっても食い違わないように、一度の evaluate で読む。 */
const readWind = (page: Page) => page.evaluate(() => {
  const meter = document.querySelector(".battle-console > .battle-wind");
  return { wind: window.__fortress!.getView().wind.value, label: meter?.querySelector(".battle-sr")?.textContent, number: meter?.querySelector("b")?.textContent, direction: meter?.getAttribute("data-direction") };
});
const expected = (wind: number) => ({ label: wind < 0 ? `左向きの風 ${-wind}` : wind > 0 ? `右向きの風 ${wind}` : "無風", number: String(Math.abs(wind)), direction: String(Math.sign(wind)) });
/** 読んだ表示が、同じ瞬間の store の風と食い違っていないか */
const consistent = (read: Awaited<ReturnType<typeof readWind>>): boolean => {
  const want = expected(read.wind);
  return read.label === want.label && read.number === want.number && read.direction === want.direction;
};

const checkLayout = async (page: Page, size: Size): Promise<void> => {
  await page.setViewportSize(size.viewport);
  const meter = meterOf(page);
  await expect(meter).toBeVisible();
  await expect.poll(async () => { const read = await readWind(page); return { ...read, ok: consistent(read) }; }).toMatchObject({ ok: true });

  const panel = await box(page.locator(".battle-console")), dial = await box(page.locator(".battle-angle")), gauge = await box(meter);
  const power = await box(page.locator(".battle-power")), movement = await box(page.locator(".battle-movement"));
  // 操作盤の高さは変えず、メーターは操作盤の中に収める
  expect(panel.height).toBe(size.panel);
  expect(gauge.x).toBeGreaterThanOrEqual(panel.x); expect(gauge.x + gauge.width).toBeLessThanOrEqual(panel.x + panel.width);
  expect(gauge.y).toBeGreaterThanOrEqual(panel.y); expect(gauge.y + gauge.height).toBeLessThanOrEqual(panel.y + panel.height);
  // 武器とアイテム（設計書 42.1）も操作盤の中に収める。アイテムの段は武器より低い
  const weapons = await page.locator(".battle-weapons > button").evaluateAll(buttons => buttons.map(b => b.getBoundingClientRect().toJSON() as Box));
  const items = await page.locator(".battle-items button").evaluateAll(buttons => buttons.map(b => b.getBoundingClientRect().toJSON() as Box));
  for (const button of [...weapons, ...items]) { expect(button.y).toBeGreaterThanOrEqual(panel.y); expect(button.y + button.height).toBeLessThanOrEqual(panel.y + panel.height); }
  for (const item of items) expect(item.height).toBeLessThan(weapons[0]!.height);
  // 角度メーターの真下。角度メーターの幅を覆う
  expect(gauge.y).toBeGreaterThanOrEqual(dial.y + dial.height - 0.5);
  expect(gauge.y).toBeLessThanOrEqual(dial.y + dial.height + 12);
  expect(gauge.x).toBeLessThanOrEqual(dial.x + 0.5);
  expect(gauge.x + gauge.width).toBeGreaterThanOrEqual(dial.x + dial.width - 0.5);
  if (size.stacked) {
    // 縦持ちは、パワーと残り移動をメーターより下の段に、盤の全幅で置く
    for (const meter_ of [power, movement]) { expect(meter_.y).toBeGreaterThanOrEqual(gauge.y + gauge.height); expect(meter_.width).toBeGreaterThanOrEqual(panel.width - 17); }
    expect(movement.y).toBeGreaterThanOrEqual(power.y + power.height);
    // 発射のボタンは狭い画面でも 44px 以上の幅を残す
    expect((await box(page.locator(".battle-touch-fire"))).width).toBeGreaterThanOrEqual(44);
  } else {
    // 残り移動は同じ下の段で、メーターの右。幅に余裕がある配置ではパワーの左端に揃える
    expect(Math.abs((movement.y + movement.height / 2) - (gauge.y + gauge.height / 2))).toBeLessThanOrEqual(1);
    expect(movement.x).toBeGreaterThanOrEqual(gauge.x + gauge.width + 4);
    if (size.viewport.width >= 480) expect(movement.x).toBeCloseTo(power.x, 0);
  }
  // 片側は 20 × 7 art px（40.3、40.10）
  for (const half of await meter.locator(".battle-wind-half").all()) expect(await box(half)).toMatchObject(size.half);
  for (const selector of [".battle-power", ".battle-weapons", ".battle-dpad", ".battle-touch-fire", ".battle-menu", ".battle-fullscreen", ".kp-minimap", ".practice-battle-status", ".turn-order-list"]) {
    const other = page.locator(selector);
    if (await other.isVisible()) expect({ selector, overlaps: overlaps(gauge, await box(other)) }).toEqual({ selector, overlaps: false });
  }
  await page.screenshot({ path: `test-results/wind-meter-${size.name}.png` });
};

for (const [name, hasTouch, sizes] of [["without touch", false, withoutTouch], ["with touch", true, withTouch]] as const) {
  test.describe(name, () => {
    test.use({ viewport: sizes[0]!.viewport, hasTouch });
    test(`wind meter sits under the angle dial inside the console and shows the current wind (${name})`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      await openPractice(page);
      for (const size of sizes) await test.step(size.name, () => checkLayout(page, size));
      // 動きを減らす設定では風の粒を消すので、メーターが風を読む唯一の手段になる。
      await test.step("reduced motion", async () => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
        await expect(meterOf(page)).toBeVisible();
        await expect.poll(async () => consistent(await readWind(page))).toBe(true);
      });
      expect(errors).toEqual([]);
    });
  });
}
