import { chromium } from "@playwright/test";

// 効果音をブラウザの OfflineAudioContext で、39 章と同じ出力経路（圧縮器、効果音量 50%）に通して書き出し、
// 100 ms 窓の RMS の最大値、-50 dB を下回るまでの長さ、サンプルピークを測る（設計書 39.5、41.14）。
// 使い方: pnpm --filter @game/e2e exec tsx scripts/sfx-measure.ts [--url http://127.0.0.1:5173] [--names explosion,debris]
// client の dev server を先に起こしておく（Vite が TypeScript のまま配る src を読み込む）。

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};

const url = arg("url", "http://127.0.0.1:5173");
const names = arg("names", "explosion,finish,debris,sizzle,impactStop,destroy").split(",");

type Row = { readonly name: string; readonly rmsDb: number; readonly lengthS: number; readonly peakDb: number };

const main = async (): Promise<void> => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${url}/?prototype=fx&still=1`);
  // tsx が関数に名前の補助を差し込むので、ブラウザで動かす部分は文字列で渡す
  const rows = (await page.evaluate(`(async (list) => {
    const sfx = await import("/src/app/sfx.ts");
    const recipes = await import("/src/app/soundRecipes.ts");
    const out = [];
    for (const name of list) {
      const rate = 48000, seconds = 3;
      const ctx = new OfflineAudioContext(1, rate * seconds, rate);
      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -14; master.knee.value = 8; master.ratio.value = 4; master.attack.value = 0.003; master.release.value = 0.25;
      const volume = ctx.createGain();
      volume.gain.value = 0.5;
      master.connect(volume).connect(ctx.destination);
      // 音程の揺れとノイズの読み出し位置を固定し、同じ値を出す
      const fixed = () => 0.5;
      // ノイズの中身は種を決めた擬似乱数で作る（定数にすると無音になる）
      let seed = 12345;
      const noiseRandom = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      sfx.playRecipe({ ctx, output: master, space: null, noise: sfx.createNoiseBuffer(ctx, noiseRandom) }, recipes.SOUNDS[name], 0, fixed);
      const data = (await ctx.startRendering()).getChannelData(0);
      const win = rate / 10;
      let rms = 0, peak = 0, last = 0;
      for (let i = 0; i + win <= data.length; i += win / 2) {
        let sum = 0;
        for (let k = i; k < i + win; k++) sum += data[k] * data[k];
        rms = Math.max(rms, Math.sqrt(sum / win));
      }
      for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); peak = Math.max(peak, a); if (a > 10 ** (-50 / 20)) last = i; }
      const db = (v) => Number((20 * Math.log10(Math.max(v, 1e-9))).toFixed(1));
      out.push({ name, rmsDb: db(rms), lengthS: Number((last / rate).toFixed(2)), peakDb: db(peak) });
    }
    return out;
  })(${JSON.stringify(names)})`)) as Row[];
  await browser.close();
  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
};

void main();
