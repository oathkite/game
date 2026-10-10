import { chromium } from "@playwright/test";
import type { FxLabStats } from "./fxLabWindow";

// FX ラボ（設計書 41.11）で武器ごとに撃ち続け、描画の間隔と 1 フレームの仕事の時間、粒の数を測る（TBD-40）。
// 使い方: pnpm --filter @game/e2e exec tsx scripts/fx-measure.ts [--url http://127.0.0.1:5173] [--gpu] [--weapons cannon,digger] [--ms 4000]
// 開発用の画面を使うので、client の dev server を先に起こしておく。

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};

const url = arg("url", "http://127.0.0.1:5173");
const weapons = arg("weapons", "cannon,triple,multiple,drill,laser,digger,bouncer,stinger").split(",");
const measureMs = Number(arg("ms", "4000"));
const gpu = process.argv.includes("--gpu");

const main = async (): Promise<void> => {
  const browser = await chromium.launch(gpu ? { channel: "chromium", args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${url}/?prototype=fx`);
  await page.waitForFunction(() => Boolean(window.__fxLab));
  const renderer = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return info && gl ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "unknown";
  });
  const rows: (FxLabStats & { weapon: string })[] = [];
  for (const weapon of weapons) {
    await page.evaluate((w) => { window.__fxLab!.setLoop(true); window.__fxLab!.fire(w); }, weapon);
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__fxLab!.resetStats());
    await page.waitForTimeout(measureMs);
    rows.push({ weapon, ...(await page.evaluate(() => window.__fxLab!.stats())) });
  }
  await browser.close();
  process.stdout.write(`${JSON.stringify({ renderer, measureMs, rows }, null, 2)}\n`);
};

void main();
