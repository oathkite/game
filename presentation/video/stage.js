// 章ごとの絵を時刻 t の関数として描く。時計は外から渡すので、1 コマずつ撮っても実時間で流しても同じ絵になる。

export const W = 1920;
export const H = 1080;

export const colors = {
  ground: '#040705',
  green: '#33ff66',
  text: '#d8f5e0',
  muted: '#86a792',
  alert: '#ff5a4f',
};

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, p) => a + (b - a) * p;
export const easeInOut = p => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
export const easeOut = p => 1 - (1 - p) ** 3;
// t が a から b へ進む割合（0〜1）。
export const span = (t, a, b) => clamp((t - a) / (b - a));

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`画像を読めない: ${src}`));
    img.src = src;
  });
}

// 画像を画面いっぱいに敷き、画像上の点 (cx, cy) を画面の中央に置いて zoom 倍にする。
export function camera(img, cx, cy, zoom) {
  const scale = Math.max(W / img.width, H / img.height) * zoom;
  const x = W / 2 - cx * scale;
  const y = H / 2 - cy * scale;
  return { scale, x, y, at: (px, py) => [x + px * scale, y + py * scale] };
}

export function drawCamera(ctx, img, cam, { smooth = true, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, cam.x, cam.y, img.width * cam.scale, img.height * cam.scale);
  ctx.restore();
}

export function lerpCamera(img, from, to, p) {
  return camera(img, lerp(from[0], to[0], p), lerp(from[1], to[1], p), lerp(from[2], to[2], p));
}

// 注目する場所に描く輪。p で描き始め、時間で脈打つ。
export function ring(ctx, x, y, r, p, t, color = colors.alert) {
  if (p <= 0) return;
  const pulse = 1 + Math.sin(t * 6) * 0.04;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.globalAlpha = clamp(p * 2);
  ctx.beginPath();
  ctx.arc(x, y, r * pulse * lerp(1.4, 1, easeOut(p)), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * easeOut(clamp(p * 1.5)));
  ctx.stroke();
  ctx.restore();
}

export function dotText(ctx, text, x, y, { size = 40, color = colors.green, alpha = 1, align = 'left' } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px "DotGothic16", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// 黒地に緑の枠で囲んだ小さな名札。
export function chip(ctx, text, x, y, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.font = '40px "DotGothic16", monospace';
  const w = ctx.measureText(text).width + 48;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(4, 7, 5, 0.85)';
  ctx.fillRect(x, y, w, 72);
  ctx.strokeStyle = colors.green;
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 2, y + 2, w - 4, 68);
  ctx.restore();
  dotText(ctx, text, x + 24, y + 38, { alpha });
}

// 章の頭に左上へ小さく出す見出し。
export function chapterTitle(ctx, number, text, t) {
  const alpha = span(t, 0.3, 0.8) * (1 - span(t, 3.2, 3.8));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, 56, 900, 96);
  ctx.restore();
  dotText(ctx, String(number).padStart(2, '0'), 64, 104, { size: 44, alpha });
  dotText(ctx, text, 150, 104, { size: 44, color: colors.text, alpha });
}

// 画像を粗いドットに崩す。block が 1 なら元のまま。
export function pixelate(ctx, img, cam, block) {
  const tmp = pixelate.canvas ??= document.createElement('canvas');
  const w = Math.max(1, Math.round(W / block));
  const h = Math.max(1, Math.round(H / block));
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(img, cam.x / block, cam.y / block, (img.width * cam.scale) / block, (img.height * cam.scale) / block);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, W, H);
  ctx.restore();
}

export function checkerboard(ctx, size = 48) {
  ctx.fillStyle = '#e9e9e4';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#c9c9c2';
  for (let y = 0; y < H; y += size) {
    for (let x = (y / size) % 2 === 0 ? 0 : size; x < W; x += size * 2) ctx.fillRect(x, y, size, size);
  }
}

// 章の頭と終わりで黒からの出入りをつける。
export function fadeEdges(ctx, t, duration, length = 0.35) {
  const alpha = Math.max(1 - span(t, 0, length), span(t, duration - length, duration));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// 連番の画像を時刻で引く。必要なコマだけを読み、古いコマは捨てる。
export function clip(dir, frames, fps = 30) {
  const cache = new Map();
  const get = i => {
    const index = Math.min(frames, Math.max(1, i));
    if (!cache.has(index)) {
      cache.set(index, loadImage(`${dir}/${String(index).padStart(4, '0')}.jpg`));
      if (cache.size > 12) cache.delete(cache.keys().next().value);
    }
    return cache.get(index);
  };
  return {
    frames,
    duration: frames / fps,
    // 再生を始めてから t 秒後のコマ。終わりを過ぎたら最後のコマで止める。
    at: t => get(Math.floor(t * fps) + 1),
  };
}

// 吹き出し。who が 'left' なら左下に、'right' なら右下にしっぽを出す。
export function bubble(ctx, x, y, w, h, p, { who = 'left', color = colors.green, text = '', size = 40 } = {}) {
  if (p <= 0) return;
  const s = lerp(0.6, 1, easeOut(clamp(p * 2)));
  ctx.save();
  ctx.globalAlpha = clamp(p * 3);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(s, s);
  ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = colors.ground;
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeRect(0, 0, w, h);
  const tail = who === 'left' ? 48 : w - 72;
  ctx.fillStyle = color;
  ctx.fillRect(tail, h, 24, 12);
  ctx.fillRect(tail + (who === 'left' ? 0 : 12), h + 12, 12, 12);
  ctx.restore();
  if (text) dotText(ctx, text, x + w / 2, y + h / 2, { size, color: colors.text, alpha: clamp(p * 3), align: 'center' });
}

// 面白さのメーター。章をまたいで同じ形で出す。最初の平らな段のあと、steps の数だけ階段が上がり、
// 各段の下にそのきっかけのアイコンを置く。rise は最後の段の上がり具合（0〜1）。
export function funMeter(ctx, steps, x, y, { alpha = 1, rise = 1, drawIcon } = {}) {
  if (alpha <= 0) return;
  const w = 120;
  const unit = 60;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(4, 7, 5, 0.85)';
  ctx.fillRect(x - 32, y - unit * 3 - 40, w * 4 + 64, unit * 3 + 140);
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y - unit * 3 - 20);
  ctx.lineTo(x, y);
  ctx.lineTo(x + w * 4, y);
  ctx.stroke();
  ctx.strokeStyle = colors.green;
  ctx.lineWidth = 10;
  ctx.beginPath();
  let level = 0;
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x + w, y - 12);
  steps.forEach((_, i) => {
    level += i === steps.length - 1 ? easeOut(rise) : 1;
    ctx.lineTo(x + w * (i + 1), y - 12 - level * unit);
    ctx.lineTo(x + w * (i + 2), y - 12 - level * unit);
  });
  ctx.stroke();
  ctx.restore();
  steps.forEach((name, i) => drawIcon?.(name, x + w * (i + 1.5), y + 48, i === steps.length - 1 ? alpha * clamp(rise * 2) : alpha));
}

// 黒地に緑の枠で囲んだ窓。中身は draw で描く。
export function framed(ctx, x, y, w, h, draw, { color = colors.green, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  draw();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
  ctx.restore();
}

// 画像を枠 (x, y, w, h) に収まるよう縮めて描く。
export function fitImage(ctx, img, x, y, w, h, { smooth = true, alpha = 1 } = {}) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = smooth;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

export async function createStage(canvas, chapter) {
  const ctx = canvas.getContext('2d');
  await document.fonts.load('40px "DotGothic16"');
  const cues = await (await fetch('../cues.json')).json();
  const module = await import(`./chapters/ch${chapter}.js`);
  const scene = await module.build(cues[chapter]);
  return {
    duration: scene.duration,
    async draw(t) {
      // 先に画像をそろえてから、まとめて描く。
      const frame = await scene.prepare?.(t);
      ctx.fillStyle = colors.ground;
      ctx.fillRect(0, 0, W, H);
      scene.draw(ctx, t, frame);
      fadeEdges(ctx, t, scene.duration);
    },
  };
}
