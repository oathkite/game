// 章の絵を 1 コマずつ撮って動画にし、録音と合わせる。
// 使い方: node presentation/video/render.mjs <章番号> [fps]
// 録音ツールのサーバー（http://localhost:8771）が presentation を配っている前提で動く。
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PLAYWRIGHT = process.env.PLAYWRIGHT_PATH
  ?? '/Users/takehitokita/Project/game/node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
const { chromium } = await import(PLAYWRIGHT);

const chapter = process.argv[2];
const fps = Number(process.argv[3] ?? 30);
const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, 'out');
mkdirSync(outDir, { recursive: true });
const silent = path.join(outDir, `ch${chapter}-video.mp4`);
const output = path.join(outDir, `ch${chapter}.mp4`);
const audio = path.join(root, '..', 'recordings', 'clean', `ch${chapter}.wav`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', error => { console.error(error); process.exit(1); });
await page.goto(`http://localhost:8771/video/stage.html?ch=${chapter}`);
await page.waitForFunction(() => window.stageReady === true, null, { timeout: 60000 });
const { duration } = await page.evaluate(() => window.stageInfo);
const frames = Math.ceil(duration * fps);

const ffmpeg = spawn('ffmpeg', [
  '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', silent,
], { stdio: ['pipe', 'inherit', 'inherit'] });

for (let f = 0; f < frames; f += 1) {
  await page.evaluate(t => window.renderAt(t), f / fps);
  const shot = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ffmpeg.stdin.write(shot)) await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));
  if (f % fps === 0) process.stdout.write(`\r${f}/${frames}`);
}
ffmpeg.stdin.end();
await new Promise(resolve => ffmpeg.on('close', resolve));
await browser.close();

await new Promise((resolve, reject) => {
  const mux = spawn('ffmpeg', [
    '-v', 'error', '-y', '-i', silent, '-i', audio,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', 'apad', '-t', String(frames / fps), output,
  ], { stdio: 'inherit' });
  mux.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
});
console.log(`\n${output}`);
