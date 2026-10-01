// 0 章「作ったもの、作った理由」。ゲームを見せ、作った動機を話し、AI と二人で作ったと伝える。
import {
  W, H, colors, span, easeOut, easeInOut, lerp, clamp, loadImage, clip, camera, drawCamera,
  dotText, chip, framed, fitImage,
} from '../stage.js';
import { icon } from '../icons.js';

// 8 人の機体の色。ゲームのチーム色に近い 8 色。
const TEAM = ['#ff4040', '#4d7cff', '#ffe14d', '#40d0ff', '#ff66c4', '#ff9f1c', '#b070ff', '#33ff66'];

export async function build(cue) {
  const play = clip('assets/clips/promo-play', 343);
  const dotWide = await loadImage('assets/dot-wide.png');
  const at = cue.lines.map(line => line.start);
  const duration = cue.duration + 0.6;

  // 1〜2 行目。紹介動画のタイトルから遊ぶ場面まで流す。
  function showGame(ctx, t, frame) {
    drawCamera(ctx, frame, camera(frame, 960, 540, 1), { smooth: false });
  }

  // 3 行目。最大 8 人。色違いの戦車が 8 台並ぶ。
  function eightPlayers(ctx, t) {
    const base = at[2];
    for (let i = 0; i < 8; i += 1) {
      const p = easeOut(span(t, base + 0.3 + i * 0.22, base + 0.7 + i * 0.22));
      icon(ctx, 'tank', 225 + i * 210, lerp(640, 580, p), 14, { color: TEAM[i], light: '#ffe14d', alpha: p });
    }
    chip(ctx, 'ONLINE', W / 2 - 112, 360, span(t, base + 2.2, base + 2.7));
  }

  // 4 行目。コーディング AI が出てきたころから、ゲームを作ってみたかった。
  function wish(ctx, t) {
    const base = at[3];
    const p = easeOut(span(t, base + 0.1, base + 0.7));
    icon(ctx, 'ai', 640, 560, 26 * p, { alpha: p });
    const q = easeOut(span(t, base + 1.6, base + 2.4));
    ctx.save();
    ctx.globalAlpha = q;
    ctx.strokeStyle = colors.green;
    ctx.lineWidth = 6;
    [[860, 470, 14], [910, 420, 20]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r * q, 0, Math.PI * 2); ctx.stroke(); });
    ctx.fillStyle = colors.ground;
    ctx.fillRect(950, 200, 560, 380);
    ctx.strokeRect(950, 200, 560, 380);
    ctx.restore();
    icon(ctx, 'tank', 1230, 390, 22 * q, { color: TEAM[0], light: '#ffe14d', alpha: q });
  }

  // 5 行目。中学生のころに遊んだ「ポトリス 2」。古いモニターに名前を映す。
  function memory(ctx, t) {
    const base = at[4];
    const p = easeOut(span(t, base + 0.1, base + 0.8));
    const size = 64 * lerp(0.8, 1, p);
    icon(ctx, 'crt', W / 2, 560, size, { color: colors.muted, light: '#2b3d33', alpha: p });
    // 画面の部分（アイコンの 2〜9 列、2〜5 行）を暗くして、名前を映す。
    ctx.save();
    ctx.globalAlpha = p;
    ctx.fillStyle = '#06100a';
    ctx.fillRect(W / 2 - 4 * size, 560 - 4 * size, 8 * size, 4 * size);
    ctx.restore();
    const glow = span(t, base + 1.0, base + 1.8);
    dotText(ctx, 'ポトリス 2', W / 2, 560 - 2 * size, { size: 84, color: colors.green, alpha: glow, align: 'center' });
  }

  // 6 行目。思い出のゲームをブラウザで作ってみる。モニターがブラウザの窓に替わる。
  function toBrowser(ctx, t, frame) {
    const base = at[5];
    const p = easeInOut(span(t, base + 0.2, base + 1.2));
    const w = lerp(760, 1440, p);
    const h = lerp(460, 810, p);
    const x = (W - w) / 2;
    const y = (H - h) / 2 + 40;
    ctx.fillStyle = colors.green;
    ctx.fillRect(x - 6, y - 64, w + 12, 64);
    [0, 1, 2].forEach(i => { ctx.fillStyle = colors.ground; ctx.fillRect(x + 24 + i * 44, y - 44, 24, 24); });
    ctx.fillStyle = colors.ground;
    ctx.fillRect(x + 180, y - 46, w - 220, 30);
    framed(ctx, x, y, w, h, () => fitImage(ctx, frame, x, y, w, h, { smooth: false }));
  }

  // 7 行目。コードは書いていない。コードの行が勝手に打たれていき、人の手は止まっている。
  function noCode(ctx, t) {
    const base = at[6];
    icon(ctx, 'person', 420, 560, 22);
    icon(ctx, 'cross', 420, 560, 30, { color: colors.alert, alpha: span(t, base + 1.2, base + 1.6) });
    const lines = [8, 14, 11, 6, 15, 12, 9, 16, 7, 13, 10];
    const typed = (t - base) * 9;
    lines.forEach((len, i) => {
      const shown = clamp(typed - i * 1.4, 0, len);
      const indent = [0, 1, 2, 2, 1, 2, 3, 3, 2, 1, 0][i];
      ctx.fillStyle = i % 3 === 0 ? colors.green : colors.text;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(820 + indent * 48, 300 + i * 46, shown * 40, 22);
      ctx.globalAlpha = 1;
    });
  }

  // 8 行目。企画から公開まで、AI と二人で作った。
  function together(ctx, t) {
    const base = at[7];
    const p = easeOut(span(t, base + 0.1, base + 0.7));
    icon(ctx, 'person', lerp(W / 2, 760, p), 480, 24);
    icon(ctx, 'ai', lerp(W / 2, 1160, p), 480, 24, { alpha: p });
    dotText(ctx, '+', W / 2, 480, { size: 96, alpha: p, align: 'center' });
    const q = easeOut(span(t, base + 1.0, base + 2.2));
    ctx.fillStyle = colors.green;
    ctx.fillRect(560, 760, 800 * q, 10);
    chip(ctx, '企画', 470, 800, span(t, base + 0.9, base + 1.3));
    chip(ctx, '公開', 1290, 800, span(t, base + 2.0, base + 2.4));
  }

  const scenes = [showGame, showGame, eightPlayers, wish, memory, toBrowser, noCode, together];

  return {
    duration,
    async prepare(t) {
      if (t < at[2]) return play.at(t);
      if (t >= at[5] && t < at[6]) return play.at(4 + t - at[5]);
      return null;
    },
    draw(ctx, t, frame) {
      let i = at.length - 1;
      while (i > 0 && t < at[i]) i -= 1;
      scenes[i](ctx, t, frame);
    },
  };
}
