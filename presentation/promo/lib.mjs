// 紹介動画の撮影の共通部分。ゲームを偽の時計で開き、1/60 秒ずつ進めて 1 コマずつ撮る。
// 鳴った効果音は、Vite が配る audio.ts の playSound に記録を差し込んで、名前と時刻を取る（client のソースは変えない）。
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, ROOT } from './pw.mjs';

export const FPS = 60;
export const BPM = 126;
export const BAR = (60 / BPM) * 4;
export const BEAT = 60 / BPM;
/** 曲の 96 拍（24 小節）のあと、先頭の 1 拍目の解決を鳴らしてから消える。全体は 10 月 1 日の版と同じ約 48 秒 */
export const TOTAL_SECONDS = 96 * BEAT + 2.4;
export const GAME_URL = process.env.GAME_URL ?? 'http://127.0.0.1:5173';
export const OUT = path.join(ROOT, 'presentation/promo/out');

/** 1 コマを 17、17、16 ms の順で進め、3 コマで 50 ms にそろえる */
const stepOf = (frame) => (frame % 3 === 2 ? 16 : 17);

/** 対戦の場面の 2 台。P1 を自分の機体にすると、P2 はスキンの一覧の次になる（client の defaultOpponentColors） */
export const LAB_LOOKS = [
  { primary: 'red', secondary: 'yellow', turret: 'fin', frame: 'reverseJoint' },
  { primary: 'cyan', secondary: 'blue', turret: 'pot', frame: 'ball' },
];

export const DEFAULT_PROFILE = {
  playerId: 'promo-player-1', nickname: 'P1',
  colors: { primary: 'red', secondary: 'yellow', turret: 'dome', frame: 'tracks' },
  loadout: ['cannon', 'digger'], volume: 0.5, bgmVolume: 0, muted: false, swapPanels: false,
};

/**
 * 偽の時計を入れたページを開く。音は鳴らさず、playSound の呼び出しだけを window.__promoSfx に残す。
 * hideCss で、撮りたくない部分（開発用のパネルなど）を隠す
 */
export const openGame = async ({ cinema = false, viewport = cinema ? CINEMA_VIEWPORT : { width: 1920, height: 1080 }, mobile = false, profile = DEFAULT_PROFILE, seed = 1, url = '/', hideCss = '' } = {}) => {
  // 旧ヘッドレスのソフトウェア描画（SwiftShader）では戦場の右下が黒く抜けるので、GPU（Metal）で描く新しいヘッドレスで開く
  const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({
    viewport, locale: 'ja-JP', deviceScaleFactor: mobile ? 3 : 1,
    ...(mobile ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('pageerror', error.message));
  await page.route('**/src/app/audio.ts*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      'export const playSound = (name) => {',
      'export const playSound = (name) => {\n  (window.__promoSfx ??= []).push([name, performance.now()]);',
    );
    await route.fulfill({ response, body });
  });
  // FX ラボの 2 台を、対戦の場面と同じ名札と機体にする
  await page.route('**/src/dev/fxLabScene.ts*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace('nickname: seat === 0 ? "shooter" : "target"', 'nickname: seat === 0 ? "P1" : "P2"')
      .replace(/colors: seat === 0 \? \{[^}]*\} : \{[^}]*\}/, `colors: seat === 0 ? ${JSON.stringify(LAB_LOOKS[0])} : ${JSON.stringify(LAB_LOOKS[1])}`);
    await route.fulfill({ response, body });
  });
  // 先手やランダムのマップを毎回同じにするため、Math.random を種つきの擬似乱数（mulberry32）に替える
  await page.addInitScript(({ profile, seed }) => {
    localStorage.setItem('fortress.tutorial.v1', '1');
    localStorage.setItem('fortress.profile.v1', JSON.stringify(profile));
    let s = seed >>> 0;
    Math.random = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, { profile, seed });
  await page.clock.install({ time: new Date('2026-10-09T12:00:00+09:00') });
  await page.goto(`${GAME_URL}${url}`);
  await page.addStyleTag({ content: `${CAPTION_CSS}\n${cinema ? CINEMA_CSS : ''}\n${hideCss}` });
  if (cinema) page.promoClip = CINEMA_CLIP;
  return { browser, context, page };
};

/** 撮らずに時計を進める。画面の読み込みやつなぎの待ちに使う */
export const skip = async (page, ms) => { await page.clock.runFor(ms); };

/** 条件が立つまで、撮らずに 50 ms ずつ時計を進める */
export const skipUntil = async (page, predicate, arg, limitMs = 30000) => {
  for (let t = 0; t < limitMs; t += 50) {
    if (await page.evaluate(predicate, arg)) return;
    await page.clock.runFor(50);
  }
  throw new Error(`skipUntil: ${limitMs} ms で条件が立たない: ${predicate}`);
};

/**
 * 場面を撮る。frames(n) で n コマ撮り、stop() で out/scenes/<name>.mp4 と、
 * 撮り始めからの秒で書いた効果音の記録 out/scenes/<name>.sfx.json を書き出す。
 * clip を渡すと、その要素の範囲だけを撮る
 */
export const record = async (page, name, { clip = page.promoClip ?? null } = {}) => {
  const dir = path.join(OUT, 'scenes');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.mp4`);
  const ffmpeg = spawn('ffmpeg', [
    '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', '-pix_fmt', 'yuv420p', file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)))));
  const startedAt = await page.evaluate(() => performance.now());
  await page.evaluate(() => { window.__promoSfx = []; });
  let count = 0;
  const marks = {};
  // コマごとのカメラの中心（セル）と機体の位置（セル）。edit.mjs が機体に寄せるときに使う
  const cams = [];
  const shoot = async () => {
    cams.push(await page.evaluate(() => {
      const el = document.querySelector('[data-testid=camera-world]');
      const v = window.__fortress?.getView();
      const c = v?.control;
      const players = v?.players?.map((p, seat) => (c && v.currentSeat === seat ? [c.x, c.y] : [p.x, p.y])) ?? null;
      return el ? [Number(el.dataset.cameraX), Number(el.dataset.cameraY), players] : null;
    }));
    const shot = await page.screenshot({ type: 'jpeg', quality: 92, ...(clip ? { clip } : {}) });
    if (!ffmpeg.stdin.write(shot)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
  };
  const holdWith = async (down, up, ms) => {
    await down();
    let held = 0;
    for (;;) {
      await shoot();
      const step = stepOf(count);
      count += 1;
      if (held + step >= ms) {
        await page.clock.runFor(ms - held);
        await up();
        await page.clock.runFor(step - (ms - held));
        return;
      }
      await page.clock.runFor(step);
      held += step;
    }
  };
  return {
    get count() { return count; },
    get marks() { return marks; },
    /** 今のコマに名前をつける。edit.mjs が切り出しの基準に使う */
    mark: (label) => { marks[label] = count; },
    /** n コマ撮る。各コマの前に onFrame(i) を呼ぶ（キーの押し下げなど） */
    frames: async (n, onFrame) => {
      for (let i = 0; i < n; i += 1) {
        if (onFrame) await onFrame(i);
        await shoot();
        await page.clock.runFor(stepOf(count));
        count += 1;
      }
    },
    /** key を ms ミリ秒だけ押して離すまでを撮る。離す瞬間はコマの途中でも ms ちょうどにする（パワーは押した時間で決まる） */
    hold: (key, ms) => holdWith(() => page.keyboard.down(key), () => page.keyboard.up(key), ms),
    /** hold と同じく、押す操作と離す操作を渡して撮る（タッチの発射ボタンなど） */
    holdWith: (down, up, ms) => holdWith(down, up, ms),
    stop: async () => {
      ffmpeg.stdin.end();
      await done;
      const log = await page.evaluate(() => window.__promoSfx ?? []);
      const sfx = log.map(([sound, at]) => ({ sound, t: Number(((at - startedAt) / 1000).toFixed(4)) })).filter((e) => e.t >= 0);
      writeFileSync(path.join(dir, `${name}.sfx.json`), `${JSON.stringify({ frames: count, marks, sfx, cams })}\n`);
      process.stdout.write(`${name}: ${count} frames, ${sfx.length} sounds\n`);
    },
  };
};

/**
 * 戦場だけを映す場面で、上に重なる欄とボタンを隠す。戦場の高さはゲームが「画面の高さ − 操作盤」で決めるので、
 * cinema で開くときは画面を操作盤の分だけ高くし、上の 1920×1080（戦場）だけを撮る
 */
export const CINEMA_CSS = `.turn-order-list, .battle-floating-timer, .battle-menu, .battle-fullscreen, .kp-minimap { visibility: hidden !important; }`;
/** どの場面でも、開始の合図（START!）、手番の表示（あなたのターン）、モードの名前（自由練習）は映さない。動画に説明の文字を入れないため */
const CAPTION_CSS = '.battle-start, .your-turn, .practice-battle-status { visibility: hidden !important; }';
const CINEMA_VIEWPORT = { width: 1920, height: 1240 };
const CINEMA_CLIP = { x: 0, y: 0, width: 1920, height: 1080 };
