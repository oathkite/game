// 1 章「初日に動いた、でも面白くなかった」。設計書を作り、その日のうちに動いたが、面白くない。
// そこから遊びながら直すやり方に変える。
import {
  W, H, colors, span, easeOut, easeInOut, lerp, clamp, loadImage, chip, chapterTitle, bubble,
  funMeter, framed, fitImage,
} from '../stage.js';
import { icon } from '../icons.js';

const LOOP = ['play', 'chat', 'wrench'];
const TIMELAPSE = 9;

export async function build(cue) {
  const [radar, ...timelapse] = await Promise.all([
    loadImage('assets/radar-game.png'),
    ...Array.from({ length: TIMELAPSE }, (_, i) => loadImage(`assets/timelapse/${String(i + 1).padStart(2, '0')}.png`)),
  ]);
  const at = cue.lines.map(line => line.start);
  const duration = cue.duration + 0.6;

  // 1 行目。頼んだのはコードではなく設計書。
  function notCode(ctx, t) {
    const base = at[0];
    icon(ctx, 'code', 640, 540, 24, { color: colors.muted, alpha: easeOut(span(t, base, base + 0.5)) });
    icon(ctx, 'cross', 640, 540, 30, { color: colors.alert, alpha: span(t, base + 1.0, base + 1.4) });
    const p = easeOut(span(t, base + 1.8, base + 2.4));
    icon(ctx, 'doc', 1280, 540, 28 * lerp(0.7, 1, p), { alpha: p });
    chapterTitle(ctx, 1, '初日に動いた、でも面白くなかった', t);
  }

  // 2 行目。ルール、マップ、画面、通信を話しながら、設計書にまとめてもらう。
  function talk(ctx, t) {
    const base = at[1];
    icon(ctx, 'person', 200, 760, 14);
    icon(ctx, 'ai', 1720, 760, 14);
    const topics = ['ルール', 'マップ', '画面', '通信'];
    const gather = easeInOut(span(t, base + 3.4, base + 4.2));
    topics.forEach((topic, i) => {
      const left = i % 2 === 0;
      const p = span(t, base + 0.3 + i * 0.7, base + 0.8 + i * 0.7);
      const x = lerp(left ? 300 : 1100, W / 2 - 260, gather);
      const y = lerp(180 + i * 140, 420, gather);
      bubble(ctx, x, y, 520, 100, p * (1 - gather), { who: left ? 'left' : 'right', text: topic, color: left ? colors.text : colors.green });
    });
    // 話した内容が紙になって積み上がる。
    for (let k = 0; k < 11; k += 1) {
      const q = easeOut(span(t, base + 4.1 + k * 0.1, base + 4.4 + k * 0.1));
      icon(ctx, 'doc', W / 2 + (k - 5) * 10, lerp(400, 600 - k * 14, q), 22, { alpha: q });
    }
  }

  // 3〜4 行目。初日のうちに動いた。弾が飛んで地面が削れる。
  function firstDay(ctx, t) {
    const x = 240;
    const y = 120;
    const w = 1440;
    const h = 1440 * radar.height / radar.width;
    framed(ctx, x, y, w, h, () => fitImage(ctx, radar, x, y, w, h, { smooth: false }));
    chip(ctx, 'DAY 1', 240, 960, span(t, at[2] + 0.3, at[2] + 0.8));
    // 4 行目で、赤い戦車から弾を撃ち、谷の斜面に穴を開ける。
    const shot = span(t, at[3] + 0.3, at[3] + 2.0);
    const sx = x + w * 0.205;
    const sy = y + h * 0.235;
    const ex = x + w * 0.47;
    const ey = y + h * 0.5;
    if (shot > 0 && shot < 1) {
      const px = lerp(sx, ex, shot);
      const py = lerp(sy, ey, shot) - Math.sin(shot * Math.PI) * h * 0.25;
      ctx.fillStyle = '#ff4040';
      ctx.fillRect(px - 8, py - 8, 16, 16);
    }
    if (shot >= 1) {
      const r = 40 * easeOut(span(t, at[3] + 2.0, at[3] + 2.3));
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(ex, ey + 10, r, 0, Math.PI * 2);
      ctx.fill();
      const flash = 1 - span(t, at[3] + 2.0, at[3] + 2.4);
      if (flash > 0) {
        ctx.fillStyle = `rgba(51, 255, 102, ${flash})`;
        ctx.beginPath();
        ctx.arc(ex, ey + 10, 60, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 5 行目。基本の動きはそろっていた。
  function basicsDone(ctx, t) {
    firstDay(ctx, Math.min(t, at[4] - 0.01));
    ctx.fillStyle = 'rgba(4, 7, 5, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ['tank', 'blast', 'dots'].forEach((name, i) => {
      const p = easeOut(span(t, at[4] + 0.3 + i * 0.4, at[4] + 0.7 + i * 0.4));
      const x = 560 + i * 400;
      icon(ctx, name, x, 480, 18, { color: name === 'tank' ? '#ff4040' : colors.green, light: '#ffe14d', alpha: p });
      icon(ctx, 'check', x, 680, 14, { alpha: p });
    });
  }

  // 6 行目。遊んでみても面白くない。メーターは平らなまま。
  function notFun(ctx, t) {
    ctx.save();
    ctx.filter = 'grayscale(1) brightness(0.45)';
    firstDay(ctx, at[4] - 0.01);
    ctx.restore();
    const p = easeOut(span(t, at[5] + 0.3, at[5] + 1.0));
    funMeter(ctx, [], W / 2 - 240, 700, { alpha: p });
  }

  // 7 行目。ルールも動きも正しいのに、何かが足りない。
  function missing(ctx, t) {
    const base = at[6];
    [['dots', 'check'], ['tank', 'check'], [null, 'question']].forEach(([name, mark], i) => {
      const p = easeOut(span(t, base + 0.3 + i * 0.5, base + 0.7 + i * 0.5));
      const x = 560 + i * 400;
      if (name) icon(ctx, name, x, 460, 18, { color: name === 'tank' ? '#ff4040' : colors.green, light: '#ffe14d', alpha: p });
      else {
        ctx.save();
        ctx.globalAlpha = p;
        ctx.strokeStyle = colors.muted;
        ctx.setLineDash([16, 12]);
        ctx.lineWidth = 6;
        ctx.strokeRect(x - 108, 352, 216, 216);
        ctx.restore();
      }
      icon(ctx, mark, x, 680, 14, { color: mark === 'question' ? colors.alert : colors.green, alpha: p });
    });
  }

  // 8〜10 行目。撃つ、伝える、直る、の輪を回す。後ろで画面が少しずつ育っていく。
  function loop(ctx, t) {
    const start = at[7];
    const local = t - start;
    const speed = t < at[9] ? 1 : lerp(1, 3.5, span(t, at[9], at[9] + 1.2));
    const turns = local * 0.45 * speed + Math.max(0, t - at[9]) * 0.9;
    const frameIndex = Math.min(TIMELAPSE - 1, Math.floor(span(t, at[8], duration - 0.6) * TIMELAPSE));
    const bg = t < at[8] ? timelapse[0] : timelapse[frameIndex];
    ctx.save();
    ctx.globalAlpha = t < at[8] ? 0.25 : 0.55;
    fitImage(ctx, bg, 0, 0, W, H);
    ctx.restore();
    ctx.fillStyle = 'rgba(4, 7, 5, 0.55)';
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H / 2;
    const r = 300;
    const appear = easeOut(span(t, start + 0.2, start + 1.0));
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // 輪の上を回る印。
    const angle = -Math.PI / 2 + turns * Math.PI * 2;
    ctx.fillStyle = colors.green;
    ctx.fillRect(cx + Math.cos(angle) * r - 14, cy + Math.sin(angle) * r - 14, 28, 28);
    ctx.restore();
    const active = Math.floor(((turns % 1) + 1) % 1 * 3);
    LOOP.forEach((name, i) => {
      const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      ctx.fillStyle = colors.ground;
      ctx.fillRect(x - 110, y - 110, 220, 220);
      const on = t >= at[8] && active === i;
      icon(ctx, name, x, y, on ? 16 : 13, { color: on ? colors.green : colors.muted, alpha: appear });
    });
  }

  const scenes = [notCode, talk, firstDay, firstDay, basicsDone, notFun, missing, loop, loop, loop];

  return {
    duration,
    draw(ctx, t) {
      let i = at.length - 1;
      while (i > 0 && t < at[i]) i -= 1;
      scenes[i](ctx, t);
    },
  };
}
