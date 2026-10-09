// 撮った場面を BGM（稜線、126 BPM）の拍に合わせて切り出し、つないで 1 本の映像にする。
// 使い方: node presentation/promo/edit.mjs（out/cuts/ に切り出し、out/video.mp4 につなぎ、out/sfx.json に効果音の並びを書く）
// 切り出しの基準は、場面の目印（mark）か鳴った音（sound）のコマ。撮り直しでコマがずれても、着弾が拍に乗ったままになる。
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BEAT, FPS, OUT, TOTAL_SECONDS } from './lib.mjs';

/** ゲームのカメラの倍率（1 セルの px、client の loadCameraScale の既定）。機体の画面上の位置を出すのに使う */
const CELL_PX = 8;
/** 機体の見た目の中心は、地表（players の y）より 3 セル上 */
const TANK_LIFT = 3;
/** HUD を出したまま撮った場面の戦場の高さ（1080 から操作盤の 160 を引く） */
const HUD_CANVAS_H = 920;
const HUD_SCENES = new Set(['core', 'items']);
const W = 1920, H = 1080;
const timelineFrame = (beat) => Math.round(beat * BEAT * FPS);

/**
 * 割り付け。beat は拍の頭（0 から）、len は拍数。from は場面の中で、この割り付けの頭に置くコマ。
 * from: { mark | sound(n 回目) | frame, offset（コマ） }。view: full | { zoom, at: [x, y] } | { zoom, follow: 席 }
 */
const CUTS = [
  // 格納庫は前半の 2 小節を引きで、入れ替わりが速くなる後半の 2 小節を機体に寄せる
  { beat: 0, len: 8, scene: 'hangar', from: { frame: 0 }, extra: 'hangarTicks' },
  { beat: 8, len: 8, scene: 'hangar', from: { frame: timelineFrame(8) }, view: { zoom: 2, at: [740, 600] }, extra: 'hangarTicks' },
  { beat: 16, len: 4, scene: 'title', from: { frame: 40 } },
  { beat: 20, len: 4, scene: 'core', from: { mark: 'opened', offset: -114 } },
  // 溜めの途中から入り、山越しの弾道を経て、32 拍目（B の頭のシンバル）で着弾する
  { beat: 24, len: 8, scene: 'core', from: { sound: 'explosion', offset: -228 } },
  { beat: 32, len: 4, scene: 'core', from: { sound: 'explosion' }, view: { zoom: 2, follow: 1 } },
  // 掘削弾を小節の頭で撃ち、2 拍目で山頂をえぐる
  { beat: 36, len: 4, scene: 'dig', from: { sound: 'digger-impact', offset: -57 } },
  ...['reverseJoint', 'hover', 'walker', 'ball'].map((frame, i) => (
    { beat: 40 + i * 2, len: 2, scene: `move-${frame}`, from: { mark: 'walk', offset: 40 }, view: { zoom: 3, follow: 0 } })),
  ...['cannon', 'triple', 'multiple', 'drill', 'laser', 'digger', 'floater', 'stinger'].map((weapon, i) => (
    { beat: 48 + i, len: 1, scene: `weapon-${weapon}`, from: { mark: 'carve', offset: -4 }, view: { zoom: 2, at: [1050, 580] }, extra: `labImpact:${weapon}` })),
  // ダブルシュートの 1 発目と 2 発目を、それぞれ拍の頭の 1 拍後に当てる
  { beat: 56, len: 4, scene: 'items', from: { sound: 'explosion', offset: -29 }, view: { zoom: 2, follow: 1 } },
  { beat: 60, len: 4, scene: 'items', from: { sound: 'explosion', nth: 2, offset: -29 }, view: { zoom: 2, follow: 1 } },
  { beat: 64, len: 4, scene: 'items', from: { mark: 'teleport', offset: 60 }, view: { zoom: 2, follow: 1 } },
  { beat: 68, len: 8, scene: 'slowmo', from: { mark: 'carve', offset: -57 }, view: { zoom: 3, at: [1230, 590] }, extra: 'slowImpact' },
  { beat: 76, len: 4, scene: 'phones', from: { mark: 'fire', offset: 40 } },
  // 盛り上がりの頭で最後の 1 発が飛び（引き）、21 小節目の 2 拍目に当たって撃破する（的に寄せる）。試合終了の画面へ移る前で切る
  { beat: 80, len: 4, scene: 'finale', from: { sound: 'explosion', offset: -143 } },
  { beat: 84, len: 4, scene: 'finale', from: { sound: 'explosion', offset: -29 }, view: { zoom: 2, follow: 1 } },
  ...['ridge', 'bridge', 'terraces', 'islands'].map((map, i) => (
    { beat: 88 + i * 2, len: 2, scene: `map-${map}`, from: { mark: 'opened', offset: -57 } })),
  { beat: 96, len: 5, scene: 'endcard', from: { frame: 0 } },
];

const sceneData = new Map();
const dataOf = (scene) => {
  if (!sceneData.has(scene)) sceneData.set(scene, JSON.parse(readFileSync(path.join(OUT, 'scenes', `${scene}.sfx.json`), 'utf8')));
  return sceneData.get(scene);
};

const startFrame = (cut) => {
  const d = dataOf(cut.scene === 'phones' ? 'phone-portrait' : cut.scene);
  const { mark, sound, nth = 1, frame, offset = 0 } = cut.from;
  if (frame !== undefined) return frame + offset;
  if (mark !== undefined) {
    if (!(mark in d.marks)) throw new Error(`${cut.scene} に目印 ${mark} が無い`);
    return d.marks[mark] + offset;
  }
  const hits = d.sfx.filter((e) => e.sound === sound);
  if (hits.length < nth) throw new Error(`${cut.scene} に音 ${sound} の ${nth} 回目が無い`);
  return Math.round(hits[nth - 1].t * FPS) + offset;
};

/** 機体の画面上の中心。HUD のある場面は戦場が 920 px の高さで、その中心がカメラの中心 */
const tankOnScreen = (scene, cam, seat) => {
  const [cx, cy, players] = cam;
  const [px, py] = players[seat];
  const canvasH = HUD_SCENES.has(scene) ? HUD_CANVAS_H : H;
  return [(px - cx) * CELL_PX + W / 2, (py - TANK_LIFT - cy) * CELL_PX + canvasH / 2];
};

/** 寄せる窓の左上。follow は前後 8 コマの平均で揺れを抑え、戦場の外へはみ出さないように止める */
const cropWindows = (cut, start, len) => {
  const { zoom } = cut.view;
  const cw = W / zoom, ch = H / zoom;
  const canvasH = HUD_SCENES.has(cut.scene) ? HUD_CANVAS_H : H;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const centers = [];
  for (let i = 0; i < len; i += 1) {
    if (cut.view.at) { centers.push(cut.view.at); continue; }
    const cams = dataOf(cut.scene).cams;
    const near = [];
    for (let k = -8; k <= 8; k += 1) {
      const cam = cams[clamp(start + i + k, 0, cams.length - 1)];
      if (cam && cam[2]) near.push(tankOnScreen(cut.scene, cam, cut.view.follow));
    }
    centers.push([near.reduce((s, p) => s + p[0], 0) / near.length, near.reduce((s, p) => s + p[1], 0) / near.length]);
  }
  return centers.map(([x, y]) => [Math.round(clamp(x - cw / 2, 0, W - cw)), Math.round(clamp(y - ch / 2, 0, canvasH - ch))]);
};

const ffmpeg = (args) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg が失敗: ${args.join(' ')}`);
};

const ENCODE = ['-c:v', 'libx264', '-preset', 'fast', '-crf', '10', '-pix_fmt', 'yuv420p', '-r', String(FPS)];

const renderCut = (cut, index, start, len, file) => {
  const trim = (n) => `trim=start_frame=${start}:end_frame=${start + len},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop=${len},trim=end_frame=${len}`;
  if (cut.scene === 'phones') {
    // 縦持ちと横持ちを、暗い地に並べる。どちらも端末の画面の大きさを保ったまま縮める
    ffmpeg(['-i', path.join(OUT, 'scenes', 'phone-portrait.mp4'), '-i', path.join(OUT, 'scenes', 'phone-landscape.mp4'),
      '-filter_complex', `color=c=0x040705:s=${W}x${H}:r=${FPS}:d=${len / FPS}[bg];`
        + `[0:v]${trim()},scale=-2:1000:flags=lanczos[p];[1:v]${trim()},scale=1200:-2:flags=lanczos[l];`
        + '[bg][p]overlay=x=150:y=40[a];[a][l]overlay=x=660:y=(H-h)/2,format=yuv420p',
      '-frames:v', String(len), ...ENCODE, file]);
    return;
  }
  const input = ['-i', path.join(OUT, 'scenes', `${cut.scene}.mp4`)];
  if (!cut.view) {
    ffmpeg([...input, '-vf', `${trim()},scale=${W}:${H}:flags=neighbor`, '-frames:v', String(len), ...ENCODE, file]);
    return;
  }
  const windows = cropWindows(cut, start, len);
  const cmds = path.join(OUT, 'cuts', `${String(index).padStart(2, '0')}.cmd`);
  writeFileSync(cmds, windows.map(([x, y], i) => `${(i / FPS).toFixed(4)} crop@v x ${x}, crop@v y ${y};`).join('\n'));
  const { zoom } = cut.view;
  ffmpeg([...input, '-vf', `${trim()},sendcmd=f=${cmds},crop@v=${W / zoom}:${H / zoom}:${windows[0][0]}:${windows[0][1]},scale=${W}:${H}:flags=neighbor`,
    '-frames:v', String(len), ...ENCODE, file]);
};

/** 撮った場面で鳴った音を、割り付けた時刻へ移す。FX ラボは音を鳴らさないので、目印から足す */
const soundsOf = (cut, start, len, at) => {
  const out = [];
  const put = (sound, frame) => { if (frame >= start && frame < start + len) out.push({ sound, t: (at + frame - start) / FPS }); };
  if (cut.scene !== 'phones') for (const e of dataOf(cut.scene).sfx) put(e.sound, Math.round(e.t * FPS));
  else for (const e of dataOf('phone-portrait').sfx) put(e.sound, Math.round(e.t * FPS));
  const [kind, arg] = (cut.extra ?? '').split(':');
  const marks = cut.scene === 'phones' ? {} : dataOf(cut.scene).marks;
  if (kind === 'hangarTicks') {
    // 機体が入れ替わる拍で、短いクリックを鳴らす（scenes.mjs の HANGAR_LOOKS と同じ拍）
    for (const b of [2, 4, 6, 8, 9, 10, 11, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5]) put('tick', Math.round(b * BEAT * FPS));
  }
  if (kind === 'labImpact') {
    const impact = arg === 'cannon' ? 'explosion' : `${arg}-impact`;
    put(impact, marks.carve);
    put('debris', marks.carve + 4);
  }
  if (kind === 'slowImpact') {
    for (const s of ['explosion', 'impactStop', 'destroy']) put(s, marks.carve);
  }
  return out;
};

const main = () => {
  mkdirSync(path.join(OUT, 'cuts'), { recursive: true });
  const list = [];
  const sounds = [];
  CUTS.forEach((cut, index) => {
    const at = timelineFrame(cut.beat);
    const len = timelineFrame(cut.beat + cut.len) - at;
    const end = cut.beat + cut.len === 101 ? Math.round(TOTAL_SECONDS * FPS) - at : len;
    const start = startFrame(cut);
    if (start < 0) throw new Error(`${cut.scene} の切り出しが場面の頭より前: ${start}`);
    const file = path.join(OUT, 'cuts', `${String(index).padStart(2, '0')}.mp4`);
    renderCut(cut, index, start, end, file);
    list.push(`file '${file}'`);
    sounds.push(...soundsOf(cut, start, end, at));
    process.stdout.write(`${String(index).padStart(2, '0')} ${cut.scene} 拍 ${cut.beat} から ${end} コマ（場面の ${start} コマ目から）\n`);
  });
  writeFileSync(path.join(OUT, 'cuts', 'list.txt'), `${list.join('\n')}\n`);
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'cuts', 'list.txt'), '-c', 'copy', path.join(OUT, 'video.mp4')]);
  writeFileSync(path.join(OUT, 'sfx.json'), `${JSON.stringify(sounds.sort((a, b) => a.t - b.t), null, 1)}\n`);
  process.stdout.write(`video.mp4: ${(TOTAL_SECONDS).toFixed(2)} 秒、効果音 ${sounds.length} 件\n`);
};

main();
