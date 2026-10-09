// 紹介動画の場面を撮る。使い方: node presentation/promo/capture.mjs <場面...>
// 場面は scenes.mjs にある。client の dev server（既定 http://127.0.0.1:5173、GAME_URL で変える）を先に起こしておく。
import { SCENES } from './scenes.mjs';

const names = process.argv.slice(2);
if (names.length === 0) {
  process.stdout.write(`場面: ${Object.keys(SCENES).join(' ')}\n`);
  process.exit(1);
}
for (const name of names) {
  const scene = SCENES[name];
  if (!scene) throw new Error(`知らない場面: ${name}`);
  const started = Date.now();
  await scene(name);
  process.stdout.write(`${name}: ${((Date.now() - started) / 1000).toFixed(0)} 秒\n`);
}
