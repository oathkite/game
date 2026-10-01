// アーティファクトを動かして、映像の素材（静止画と連番）を書き出す。
// 使い方: node presentation/video/capture.mjs
// 録音ツールのサーバー（http://localhost:8771）が presentation を配っている前提で動く。
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PLAYWRIGHT = process.env.PLAYWRIGHT_PATH
  ?? '/Users/takehitokita/Project/game/node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
const { chromium } = await import(PLAYWRIGHT);
const assets = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets');
const base = 'http://localhost:8771/video/artifacts';
const browser = await chromium.launch();

async function open(file, viewport = { width: 1920, height: 1080 }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', error => console.error(file, error));
  await page.goto(`${base}/${file}`);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

// 初日のモック。ゲーム画面の枠だけを撮る。
async function radar() {
  const page = await open('radar.html');
  await page.locator('.screen').nth(3).screenshot({ path: path.join(assets, 'radar-game.png') });
  await page.close();
}

// 地形スケッチ。既存の 8 枚を画像にし、白紙から地表ペンで丘を描く様子を連番で撮る。
async function sketch() {
  const page = await open('sketch.html', { width: 1600, height: 900 });
  const maps = await page.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll('#templates button')) {
      b.click();
      out.push({ label: b.textContent, png: document.getElementById('cv').toDataURL('image/png') });
    }
    return out;
  });
  mkdirSync(path.join(assets, 'maps'), { recursive: true });
  maps.forEach((m, i) => writeFileSync(path.join(assets, 'maps', `${i}.png`), Buffer.from(m.png.split(',')[1], 'base64')));
  writeFileSync(path.join(assets, 'maps', 'labels.json'), JSON.stringify(maps.map(m => m.label)));

  await page.click('#clear');
  await page.click('[data-tool="surface"]');
  await page.click('[data-size="6"]');
  const box = await page.locator('#cv').boundingBox();
  const at = (x, y) => [box.x + (x / 400) * box.width, box.y + (y / 225) * box.height];
  // 左の高台、中央の谷、右の山。手で描いたように少し揺らす。
  const height = x => 150 - 40 * Math.exp(-(((x - 70) / 45) ** 2)) + 35 * Math.exp(-(((x - 200) / 40) ** 2))
    - 60 * Math.exp(-(((x - 320) / 35) ** 2)) + 3 * Math.sin(x / 7);
  const out = path.join(assets, 'ch3-draw');
  mkdirSync(out, { recursive: true });
  const region = { x: 0, y: 0, width: 1600, height: 900 };
  let frame = 0;
  const shot = async () => page.screenshot({ path: path.join(out, `${String(++frame).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 92, clip: region });
  for (let i = 0; i < 8; i += 1) await shot();
  await page.mouse.move(...at(2, height(2)));
  await page.mouse.down();
  for (let x = 2; x <= 398; x += 4) {
    await page.mouse.move(...at(x, height(x)), { steps: 2 });
    await shot();
  }
  await page.mouse.up();
  for (let i = 0; i < 20; i += 1) await shot();
  console.log(`sketch: ${maps.length} maps, ${frame} frames`);
  await page.close();
}

// 演出案。時計を止めて 1 コマずつ進め、エフェクトの 4 案のデモの canvas をそのまま取り出す。
async function fx() {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.clock.install();
  await page.goto(`${base}/fx.html`);
  await page.evaluate(() => document.fonts.ready);
  const names = ['parity', 'crumble', 'trail', 'weapons'];
  const out = path.join(assets, 'ch5-fx');
  mkdirSync(out, { recursive: true });
  // デモは見えている間だけ動くので、4 つとも画面に入るように縮める。
  await page.evaluate(() => { document.body.style.zoom = '0.25'; });
  for (let f = 1; f <= 240; f += 1) {
    await page.clock.runFor(1000 / 30);
    const urls = await page.evaluate(list => list.map(n => document.querySelector(`canvas[data-demo="${n}"]`).toDataURL('image/png')), names);
    urls.forEach((url, i) => writeFileSync(path.join(out, `${names[i]}-${String(f).padStart(3, '0')}.png`), Buffer.from(url.split(',')[1], 'base64')));
  }
  console.log('fx: 240 frames x 4');
  await page.close();
}

const only = process.argv[2];
if (!only || only === 'radar') await radar();
if (!only || only === 'sketch') await sketch();
if (!only || only === 'fx') await fx();
await browser.close();
