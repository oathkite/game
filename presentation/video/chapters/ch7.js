// 7 章「振り返り」。AI は使い方次第でいろいろできる。ただし分野の知識が要り、進歩も速いので、学び続けることが大切。
import {
  W, H, colors, span, easeOut, easeInOut, lerp, clamp, loadImage, clip, camera, drawCamera, chip,
  chapterTitle, framed, fitImage, dotText,
} from '../stage.js';
import { icon } from '../icons.js';

const SCENES = [['doc', colors.green], ['camera', colors.green], ['pencil', colors.green], ['dots', colors.green], ['blast', '#ffe14d'], ['note', colors.green]];
const NEW_THINGS = ['ai', 'browser', 'film', 'code', 'chat', 'camera', 'note', 'pencil', 'ai', 'doc'];
const META = 8;

export async function build(cue) {
  const meta = await Promise.all(Array.from({ length: META }, (_, i) => loadImage(`assets/meta/${i + 1}.png`)));
  const logo = clip('assets/clips/promo-logo', 126);
  const at = cue.lines.map(line => line.start);
  const script = cue.lines.map(line => line.text);
  const duration = cue.duration + 1.2;

  // 1 行目。どの場面も手探りだったが、使い方を変えて進めた。各章のアイコンが並ぶ。
  function scenesRow(ctx, t) {
    chapterTitle(ctx, 7, '振り返り', t);
    SCENES.forEach(([name, color], i) => {
      const p = easeOut(span(t, at[0] + 0.4 + i * 0.35, at[0] + 0.8 + i * 0.35));
      icon(ctx, name, 310 + i * 260, 540, 14, { color, alpha: p });
    });
  }

  // 2 行目。AI は使い方次第でいろいろできる。アイコンが AI を囲む輪になる。
  function aroundAi(ctx, t) {
    const p = easeInOut(span(t, at[1] + 0.1, at[1] + 1.4));
    SCENES.forEach(([name, color], i) => {
      const a = -Math.PI / 2 + (i / SCENES.length) * Math.PI * 2;
      const x = lerp(310 + i * 260, W / 2 + Math.cos(a) * 380, p);
      const y = lerp(540, 540 + Math.sin(a) * 380, p);
      ctx.save();
      ctx.globalAlpha = p * 0.6;
      ctx.strokeStyle = colors.muted;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(W / 2, 540);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = colors.ground;
      ctx.fillRect(x - 100, y - 100, 200, 200);
      icon(ctx, name, x, y, 12, { color });
    });
    icon(ctx, 'ai', W / 2, 540, 18 * p, { alpha: p });
  }

  // 3 行目。この動画も AI で作った。
  function thisVideo(ctx, t) {
    const p = easeOut(span(t, at[2] + 0.1, at[2] + 0.7));
    icon(ctx, 'film', W / 2, 540, 26 * lerp(0.6, 1, p), { alpha: p });
  }

  // 4 行目。台本と映像は Claude Code に作ってもらった。左に台本、右にこの動画のコマ。
  function madeBy(ctx, t) {
    const p = easeOut(span(t, at[3] + 0.1, at[3] + 0.8));
    ctx.save();
    ctx.globalAlpha = p * 0.55;
    const scroll = (t - at[3]) * 40;
    for (let i = 0; i < 14; i += 1) {
      dotText(ctx, script[i % script.length].slice(0, 22), 120, 220 + i * 56 - (scroll % 56), { size: 32, color: colors.text, alpha: 1 });
    }
    ctx.restore();
    meta.forEach((img, i) => {
      const q = easeOut(span(t, at[3] + 0.5 + i * 0.25, at[3] + 0.9 + i * 0.25));
      const x = 1000 + (i % 2) * 420;
      const y = 140 + Math.floor(i / 2) * 210;
      framed(ctx, x, y, 380, 190, () => fitImage(ctx, img, x, y, 380, 190), { alpha: q, color: colors.muted });
    });
  }

  // 5〜6 行目。使いこなすには分野の知識が要る。音楽は、知識があればもっと良くできたと今も思う。
  function knowledge(ctx, t) {
    const base = at[4];
    const p = easeOut(span(t, base + 0.2, base + 0.8));
    icon(ctx, 'ai', 560, 520, 18, { alpha: p });
    dotText(ctx, '+', 860, 520, { size: 96, align: 'center', alpha: span(t, base + 0.9, base + 1.3) });
    icon(ctx, 'book', 1160, 520, 18, { alpha: span(t, base + 1.2, base + 1.7) });
    if (t >= at[5]) {
      const q = easeOut(span(t, at[5] + 0.2, at[5] + 0.8));
      ctx.fillStyle = colors.ground;
      ctx.fillRect(0, 0, W, H);
      icon(ctx, 'note', 700, 540, 20, { alpha: q });
      icon(ctx, 'person', 1180, 560, 16, { alpha: q });
      icon(ctx, 'question', 1300, 380, 8, { color: colors.muted, alpha: span(t, at[5] + 1.2, at[5] + 1.6) });
    }
  }

  // 7〜8 行目。AI の進歩は速い。新しいものが右から次々に流れてくる。開発の途中にも Opus 5.5 が来た。
  function fastPace(ctx, t) {
    const local = t - at[6];
    ctx.fillStyle = colors.muted;
    ctx.fillRect(160, 760, 1600, 8);
    NEW_THINGS.forEach((name, i) => {
      const x = 1900 - (local - i * 0.45) * 520;
      if (x < 140 || x > 1900) return;
      icon(ctx, name, x, 640, 8, { color: colors.green, alpha: clamp((1900 - x) / 200) });
    });
    if (t >= at[7]) {
      const q = easeOut(span(t, at[7] + 0.2, at[7] + 0.8));
      ctx.fillStyle = colors.ground;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = colors.muted;
      ctx.fillRect(260, 600, 1400, 10);
      const mx = 260 + 1400 * 0.62;
      ctx.fillStyle = colors.green;
      ctx.fillRect(mx - 6, 520, 12, 80);
      chip(ctx, 'Opus 5.5', mx - 120, 400, q);
      icon(ctx, 'blast', mx, 760, 10, { color: '#ffe14d', alpha: span(t, at[7] + 1.0, at[7] + 1.5) });
    }
  }

  // 9〜10 行目。任せられることが増えるほど、自分が学び続けることが大切になる。
  function keepLearning(ctx, t) {
    const grow = easeOut(span(t, at[8] + 0.2, at[9]));
    icon(ctx, 'ai', 1260, 520, lerp(12, 22, grow));
    icon(ctx, 'person', 660, 520, 18);
    for (let k = 0; k < 5; k += 1) {
      const q = easeOut(span(t, at[8] + 1.0 + k * 0.6, at[8] + 1.4 + k * 0.6));
      ctx.save();
      ctx.globalAlpha = q;
      ctx.fillStyle = [colors.green, colors.text, '#ffe14d', colors.green, colors.text][k];
      ctx.fillRect(540, 760 - k * 34, 240, 26);
      ctx.restore();
    }
  }

  // 11〜12 行目。終わりのあいさつ。ゲームのロゴと、人と AI の 2 つのアイコン。
  function ending(ctx, t, frame) {
    drawCamera(ctx, frame, camera(frame, 960, 540, 1), { smooth: false });
    const p = easeOut(span(t, at[11], at[11] + 0.8));
    icon(ctx, 'person', W / 2 - 90, 900, 7, { alpha: p });
    icon(ctx, 'ai', W / 2 + 90, 900, 7, { alpha: p });
  }

  const scenes = [scenesRow, aroundAi, thisVideo, madeBy, knowledge, knowledge, fastPace, fastPace, keepLearning, keepLearning, ending, ending];

  return {
    duration,
    async prepare(t) {
      // ロゴの映像は、公開先の URL が出る前のコマで止める。
      if (t >= at[10]) return logo.at(Math.min(t - at[10], 1.4));
      return null;
    },
    draw(ctx, t, frame) {
      let i = at.length - 1;
      while (i > 0 && t < at[i]) i -= 1;
      scenes[i](ctx, t, frame);
    },
  };
}
