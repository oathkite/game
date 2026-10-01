// 指定した時刻の絵を PNG に書き出して確かめる。使い方: node presentation/video/stills.mjs <章> <秒...>
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
const PLAYWRIGHT = process.env.PLAYWRIGHT_PATH
  ?? '/Users/takehitokita/Project/game/node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
const { chromium } = await import(PLAYWRIGHT);
const [chapter, ...times] = process.argv.slice(2);
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'stills');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => { console.error(e); process.exit(1); });
await page.goto(`http://localhost:8771/video/stage.html?ch=${chapter}`);
await page.waitForFunction(() => window.stageReady === true, null, { timeout: 60000 });
for (const t of times) {
  await page.evaluate(v => window.renderAt(v), Number(t));
  await page.screenshot({ path: path.join(out, `ch${chapter}-${t}.png`) });
}
await browser.close();
