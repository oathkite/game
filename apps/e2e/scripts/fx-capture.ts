import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import type {} from "./fxLabWindow";

// FX ラボ（設計書 41.11）で撃ち、地形が削れた瞬間から決めた時刻の絵を PNG に書き出す。演出の評価と改善に使う。
// 使い方: pnpm --filter @game/e2e exec tsx scripts/fx-capture.ts --out <dir> [--url http://127.0.0.1:5173] [--weapons cannon,digger] [--marks -300,0,150,400,900,1600]
// 負の時刻は削る瞬間より前（弾の飛翔と爆風の広がり）。--idle では撃たずに、開いてからの時刻で撮る（揺れものと背景の動きを見る）。
// client の dev server を先に起こしておく。

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};

const url = arg("url", "http://127.0.0.1:5173");
const out = arg("out", "fx-capture");
const weapons = arg("weapons", "cannon").split(",");
const marks = arg("marks", "-150,0,150,400,900,1600").split(",").map(Number);
const targetHp = Number(arg("hp", "100"));
const idle = process.argv.includes("--idle");

const main = async (): Promise<void> => {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${url}/?prototype=fx&still=1`);
  await page.waitForFunction(() => Boolean(window.__fxLab));
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "[data-testid=fx-panel]{display:none !important}" });
  await page.evaluate((hp) => window.__fxLab!.setTargetHp(hp), targetHp);
  if (idle) {
    let at = 0;
    for (const mark of marks) {
      await page.evaluate((ms) => window.__fxLab!.step(Math.max(1, ms)), mark - at);
      at = mark;
      await page.getByTestId("fx-lab").screenshot({ path: `${out}/idle_${mark}.png` });
    }
    await browser.close();
    return;
  }
  for (const weapon of weapons) {
    // 削る瞬間までの ms。先に 1 回撃って測り、同じ射撃を撃ち直して決めた時刻まで進める
    const carveAt = await page.evaluate((w) => {
      const lab = window.__fxLab!;
      lab.setLoop(false); lab.fire(w);
      let t = 0;
      while (lab.stats().carves === 0 && t < 8000) { lab.step(16); t += 16; }
      return t;
    }, weapon);
    for (const mark of marks) {
      await page.evaluate(({ w, ms }) => { const lab = window.__fxLab!; lab.fire(w); lab.step(Math.max(1, ms)); }, { w: weapon, ms: carveAt + mark });
      await page.getByTestId("fx-lab").screenshot({ path: `${out}/${weapon}_${mark}.png` });
    }
  }
  await browser.close();
};

void main();
