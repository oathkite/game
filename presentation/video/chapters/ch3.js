// 3 章「形は、描いて伝える」。言葉では地形の形が伝わらないので、描いて渡すツールを作ってもらった。
import {
  W, H, colors, span, easeOut, easeInOut, lerp, clamp, loadImage, chapterTitle, bubble, framed,
  fitImage, dotText,
} from '../stage.js';
import { icon } from '../icons.js';

const DRAW_FRAMES = 128;
const MAPS = 8;
const ORIGINAL_MAPS = 3;

// 思い描いた地形（破線）と、言葉で頼んで返ってきた地形。x は 0〜1、戻り値は画面の y。
const wanted = x => 760 - 140 * Math.exp(-(((x - 0.22) / 0.13) ** 2)) + 60 * Math.exp(-(((x - 0.5) / 0.1) ** 2)) - 120 * Math.exp(-(((x - 0.8) / 0.12) ** 2));
const attempts = [
  x => 760 - 80 * Math.exp(-(((x - 0.3) / 0.2) ** 2)) + 140 * Math.exp(-(((x - 0.55) / 0.08) ** 2)) - 40 * Math.exp(-(((x - 0.85) / 0.1) ** 2)),
  x => 760 - 200 * Math.exp(-(((x - 0.15) / 0.08) ** 2)) + 20 * Math.exp(-(((x - 0.45) / 0.2) ** 2)) - 160 * Math.exp(-(((x - 0.7) / 0.1) ** 2)),
  x => 760 - 120 * Math.exp(-(((x - 0.3) / 0.1) ** 2)) + 90 * Math.exp(-(((x - 0.62) / 0.12) ** 2)) - 60 * Math.exp(-(((x - 0.9) / 0.2) ** 2)),
];

export async function build(cue) {
  const [maps, draw] = await Promise.all([
    Promise.all(Array.from({ length: MAPS }, (_, i) => loadImage(`assets/maps/${i}.png`))),
    Promise.all(Array.from({ length: DRAW_FRAMES }, (_, i) => loadImage(`assets/ch3-draw/${String(i + 1).padStart(3, '0')}.jpg`))),
  ]);
  const at = cue.lines.map(line => line.start);
  const duration = cue.duration + 0.6;

  function terrain(ctx, f, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.text;
    ctx.beginPath();
    ctx.moveTo(160, 1000);
    for (let x = 0; x <= 1; x += 0.005) ctx.lineTo(160 + x * 1600, f(x));
    ctx.lineTo(1760, 1000);
    ctx.fill();
    ctx.restore();
  }

  function wantedLine(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colors.green;
    ctx.lineWidth = 8;
    ctx.setLineDash([20, 14]);
    ctx.beginPath();
    for (let x = 0; x <= 1; x += 0.005) ctx.lineTo(160 + x * 1600, wanted(x));
    ctx.stroke();
    ctx.restore();
  }

  // 1〜2 行目。言葉で形を頼んでも、思い描いた地形にならない。
  function byWords(ctx, t) {
    chapterTitle(ctx, 3, '形は、描いて伝える', t);
    wantedLine(ctx, easeOut(span(t, at[0] + 0.6, at[0] + 1.4)));
    const tries = Math.min(attempts.length - 1, Math.max(0, Math.floor((t - at[1]) / 2)));
    const shape = t < at[1] ? attempts[0] : attempts[tries];
    terrain(ctx, shape, easeOut(span(t, at[0] + 1.6, at[0] + 2.4)));
    if (t >= at[1]) {
      const local = (t - at[1]) % 2;
      icon(ctx, 'cross', 1640, 300, 14, { color: colors.alert, alpha: span(local, 1.0, 1.3) * (1 - span(local, 1.8, 2)) });
    }
    bubble(ctx, 300, 180, 640, 110, span(t, at[1] + 0.2, at[1] + 0.7), { text: '左の丘をもう少し高く', color: colors.text });
    bubble(ctx, 980, 180, 600, 110, span(t, at[1] + 2.4, at[1] + 2.9), { text: '真ん中の谷を浅く', color: colors.text });
  }

  // 3 行目。どう伝えればいいかを考えて、アーティファクトを思いつく。
  function idea(ctx, t) {
    const p = easeOut(span(t, at[2] + 0.2, at[2] + 0.8));
    icon(ctx, 'bulb', 700, 520, 22 * lerp(0.6, 1, p), { color: '#ffe14d', alpha: p });
    const q = easeOut(span(t, at[2] + 3.2, at[2] + 3.9));
    icon(ctx, 'browser', 1220, 520, 26 * lerp(0.6, 1, q), { alpha: q });
  }

  // 4 行目。その場で動く小さなウェブページ。地形スケッチの画面が開く。
  function openTool(ctx, t) {
    const p = easeInOut(span(t, at[3] + 0.1, at[3] + 1.1));
    const w = lerp(400, 1600, p);
    const h = w * 9 / 16;
    const x = (W - w) / 2;
    const y = (H - h) / 2;
    framed(ctx, x, y, w, h, () => fitImage(ctx, draw[0], x, y, w, h));
  }

  // 5〜6 行目。手で描いて、そのまま AI に渡す。
  function drawing(ctx, t) {
    const index = clamp(Math.floor((t - at[4] + 0.2) * 30), 0, DRAW_FRAMES - 1);
    const hand = easeInOut(span(t, at[5] + 0.6, at[6] - 0.4));
    const w = lerp(1600, 520, hand);
    const h = w * 9 / 16;
    const x = lerp((W - 1600) / 2, 380, hand);
    const y = lerp((H - 900) / 2, (H - h) / 2, hand);
    framed(ctx, x, y, w, h, () => fitImage(ctx, draw[index], x, y, w, h));
    if (hand > 0) {
      icon(ctx, 'ai', 1500, 540, 20, { alpha: hand });
      ctx.save();
      ctx.globalAlpha = hand;
      ctx.fillStyle = colors.green;
      const reach = lerp(940, 1340, easeOut(span(t, at[5] + 1.2, at[6] - 0.2)));
      ctx.fillRect(940, 532, reach - 940, 16);
      ctx.restore();
    }
  }

  // 7 行目。うまくいき、マップは 3 枚から 8 枚に増えた。
  function eightMaps(ctx, t) {
    const base = at[6];
    const tw = 400;
    const th = 225;
    for (let i = 0; i < MAPS; i += 1) {
      const appear = i < ORIGINAL_MAPS ? span(t, base, base + 0.4) : span(t, base + 1.2 + (i - ORIGINAL_MAPS) * 0.2, base + 1.5 + (i - ORIGINAL_MAPS) * 0.2);
      const x = 120 + (i % 4) * 440;
      const y = 250 + Math.floor(i / 4) * 300;
      framed(ctx, x, y, tw, th, () => fitImage(ctx, maps[i], x, y, tw, th, { smooth: false }), {
        alpha: easeOut(appear),
        color: i < ORIGINAL_MAPS ? colors.muted : colors.green,
      });
    }
    const count = t < base + 1.2 ? ORIGINAL_MAPS : Math.min(MAPS, ORIGINAL_MAPS + Math.floor((t - base - 1.2) / 0.2) + 1);
    dotText(ctx, String(count), W / 2, 150, { size: 120, align: 'center', alpha: span(t, base, base + 0.4) });
  }

  const scenes = [byWords, byWords, idea, openTool, drawing, drawing, eightMaps];

  return {
    duration,
    draw(ctx, t) {
      let i = at.length - 1;
      while (i > 0 && t < at[i]) i -= 1;
      scenes[i](ctx, t);
    },
  };
}
