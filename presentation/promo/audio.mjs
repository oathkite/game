// 紹介動画の音を作る。BGM（稜線）の上に、edit.mjs が並べた効果音（out/sfx.json）を、ゲームと同じレシピと出力経路で重ねる。
// 使い方: node presentation/promo/audio.mjs（out/audio.wav、48 kHz ステレオ）
// client の dev server が要る。ブラウザの OfflineAudioContext で、Vite が配る sfx.ts と soundRecipes.ts をそのまま使う。
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from './pw.mjs';
import { BEAT, GAME_URL, OUT, TOTAL_SECONDS } from './lib.mjs';

const events = JSON.parse(readFileSync(path.join(OUT, 'sfx.json'), 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${GAME_URL}/?prototype=fx&still=1`);

// tsx を通さないので関数はそのまま渡せる。音量はゲームの既定（効果音 50%、BGM 50%）と同じ
const base64 = await page.evaluate(async ({ events, total, loopAt }) => {
  const sfx = await import('/src/app/sfx.ts');
  const { SOUNDS } = await import('/src/app/soundRecipes.ts');
  const rate = 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * rate), rate);
  let seed = 20261009;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // BGM。曲の 24 小節のあと、先頭からもう 1 度鳴らし始めて 1 小節目の頭で解決させ、そのまま消す（audio.ts の createMusicChain と同じ経路）
  const music = await ctx.decodeAudioData(await (await fetch('/src/assets/music/ridgeline.ogg')).arrayBuffer());
  const musicOutput = ctx.createGain();
  musicOutput.gain.value = 0.5;
  const duck = ctx.createGain();
  musicOutput.connect(duck).connect(ctx.destination);
  const body = ctx.createBufferSource();
  body.buffer = music;
  body.connect(musicOutput);
  body.start(0, 0, loopAt);
  const tail = ctx.createBufferSource();
  tail.buffer = music;
  const tailGain = ctx.createGain();
  tailGain.gain.setValueAtTime(1, loopAt + 0.6);
  tailGain.gain.linearRampToValueAtTime(0, total);
  tail.connect(tailGain).connect(musicOutput);
  tail.start(loopAt, 0, total - loopAt);

  // 効果音（audio.ts の createEffectsChain と createSfxGraph と同じ経路）
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -14; master.knee.value = 8; master.ratio.value = 4; master.attack.value = 0.003; master.release.value = 0.25;
  const output = ctx.createGain();
  output.gain.value = 0.5;
  master.connect(output).connect(ctx.destination);
  const space = ctx.createConvolver();
  space.buffer = sfx.createImpulse(ctx, 1.6, 0.38, random);
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  space.connect(wet).connect(master);
  const graph = { ctx, output: master, space, noise: sfx.createNoiseBuffer(ctx, random) };

  // 同じ音を詰めて重ねない間隔と、着弾で BGM を下げる量（audio.ts の playSound と duckMusic と同じ）
  const last = new Map();
  let activeDuck = { amount: 0, at: -Infinity };
  for (const { sound, t } of events) {
    const recipe = SOUNDS[sound];
    if (!recipe) throw new Error(`知らない音: ${sound}`);
    const interval = sound.startsWith('move-') ? 0.075 : 0.03;
    if (t - (last.get(sound) ?? -Infinity) < interval) continue;
    last.set(sound, t);
    sfx.playRecipe(graph, recipe, t, random);
    const amount = recipe.duck ?? 0;
    if (amount > 0 && !(t < activeDuck.at + 0.12 && amount <= activeDuck.amount)) {
      activeDuck = { amount, at: t };
      duck.gain.cancelScheduledValues(t);
      duck.gain.setTargetAtTime(1 - amount, t, 0.01);
      duck.gain.setTargetAtTime(1, t + 0.12, 0.35);
    }
  }

  const rendered = await ctx.startRendering();
  // 16 bit の WAV に書く
  const frames = rendered.length, channels = rendered.numberOfChannels;
  const buffer = new DataView(new ArrayBuffer(44 + frames * channels * 2));
  const text = (offset, s) => [...s].forEach((c, i) => buffer.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); buffer.setUint32(4, 36 + frames * channels * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  buffer.setUint32(16, 16, true); buffer.setUint16(20, 1, true); buffer.setUint16(22, channels, true);
  buffer.setUint32(24, rate, true); buffer.setUint32(28, rate * channels * 2, true); buffer.setUint16(32, channels * 2, true); buffer.setUint16(34, 16, true);
  text(36, 'data'); buffer.setUint32(40, frames * channels * 2, true);
  const data = [...Array(channels).keys()].map((c) => rendered.getChannelData(c));
  for (let i = 0; i < frames; i += 1) {
    for (let c = 0; c < channels; c += 1) buffer.setInt16(44 + (i * channels + c) * 2, Math.max(-1, Math.min(1, data[c][i])) * 32767, true);
  }
  const bytes = new Uint8Array(buffer.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}, { events, total: TOTAL_SECONDS, loopAt: 96 * BEAT });

writeFileSync(path.join(OUT, 'audio.wav'), Buffer.from(base64, 'base64'));
await browser.close();
process.stdout.write(`audio.wav: ${TOTAL_SECONDS.toFixed(2)} 秒、効果音 ${events.length} 件\n`);
