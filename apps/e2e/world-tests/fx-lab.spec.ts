import { expect, test, type Page } from "@playwright/test";
import type {} from "../scripts/fxLabWindow";

// FX ラボ（設計書 41.11）の決めた時刻の絵を比べ、演出の見た目の変化を検出する。
// still=1 では描画の時計が自分では進まず、step で 16 ms ずつ進めるので、同じ時刻には毎回同じ絵になる。
// 絵を変えたときは --update-snapshots で基準を撮り直し、差分が意図した変化だけであることを画像で確かめる。

/** 撃って、地形が削れて破片が出る瞬間まで進める。進めた ms を返す */
const fireUntilCarve = (page: Page, weapon: string): Promise<number> => page.evaluate((w) => {
  const lab = window.__fxLab!;
  lab.setLoop(false);
  lab.fire(w);
  let t = 0;
  while (lab.stats().carves === 0 && t < 8000) { lab.step(16); t += 16; }
  return Math.round(t);
}, weapon);

const open = async (page: Page): Promise<void> => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?prototype=fx&still=1");
  await page.waitForFunction(() => Boolean(window.__fxLab));
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "[data-testid=fx-panel]{display:none !important}" });
};

test("標準砲の着弾から決めた時刻の絵が変わらない", async ({ page }) => {
  await open(page);
  const carveAt = await fireUntilCarve(page, "cannon");
  expect(carveAt).toBeGreaterThan(0);
  let at = 0;
  for (const mark of [0, 50, 150, 400, 1500]) {
    await page.evaluate((ms) => window.__fxLab!.step(ms), Math.max(1, mark - at));
    at = mark;
    await expect(page.getByTestId("fx-lab")).toHaveScreenshot(`cannon-${mark}.png`, { maxDiffPixels: 0 });
  }
});

test("同じ射撃を撃ち直すと、同じ時刻に同じ数の破片が出る", async ({ page }) => {
  await open(page);
  const count = async (): Promise<number> => {
    await fireUntilCarve(page, "digger");
    return page.evaluate(() => { window.__fxLab!.step(300); return window.__fxLab!.stats().particles; });
  };
  const first = await count();
  expect(first).toBeGreaterThan(1000);
  expect(await count()).toBe(first);
});
