// 5 章「エフェクトは、作例をまねる」。Opus 5.5 の公開と X の作例をきっかけに、演出を作り込んだ。
import {
  W, H, colors, span, easeOut, easeInOut, lerp, loadImage, clip, camera, drawCamera, chip,
  chapterTitle, bubble, funMeter, framed, fitImage, dotText,
} from '../stage.js';
import { icon } from '../icons.js';

const FX = ['parity', 'crumble', 'trail', 'weapons'];
const FX_FRAMES = 240;
const CHOSEN = 0;

export async function build(cue) {
  const blizzard = clip('assets/clips/x-blizzard', 180);
  const meteor = clip('assets/clips/x-meteor', 180);
  const laser = clip('assets/clips/promo-laser', 115);
  const dotWide = await loadImage('assets/dot-wide.png');
  const fxCache = new Map();
  const fxFrame = (name, i) => {
    const key = `${name}-${String(i).padStart(3, '0')}`;
    if (!fxCache.has(key)) {
      fxCache.set(key, loadImage(`assets/ch5-fx/${key}.png`));
      if (fxCache.size > 16) fxCache.delete(fxCache.keys().next().value);
    }
    return fxCache.get(key);
  };
  const at = cue.lines.map(line => line.start);
  const duration = cue.duration + 0.6;

  // 1 行目。開発の途中で Opus 5.5 が出た。開発の期間を線で引き、その途中に印を落とす。
  function release(ctx, t) {
    chapterTitle(ctx, 5, 'エフェクトは、作例をまねる', t);
    const grow = easeOut(span(t, at[0] + 0.2, at[0] + 1.6));
    ctx.fillStyle = colors.muted;
    ctx.fillRect(260, 600, 1400 * grow, 10);
    chip(ctx, 'DAY 1', 200, 640, span(t, at[0] + 0.2, at[0] + 0.6));
    const drop = easeOut(span(t, at[0] + 1.6, at[0] + 2.2));
    const mx = 260 + 1400 * 0.62;
    ctx.fillStyle = colors.green;
    ctx.fillRect(mx - 6, lerp(380, 520, drop), 12, 80 * drop);
    chip(ctx, 'Opus 5.5', mx - 120, lerp(260, 400, drop), drop);
  }

  // 2 行目。X で、Opus 5.5 でドット絵のエフェクトを作る人を多く見かけた。
  function xPost(ctx, t, frame) {
    const x = 200;
    const y = 120;
    const w = 1520;
    const h = 855;
    framed(ctx, x, y, w, h, () => drawCamera(ctx, frame, camera(frame, 960, 540, 1), { smooth: false }));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(w / W, h / H);
    ctx.restore();
    chip(ctx, 'X  @rehan_shei', x, y + h + 24, span(t, at[1] + 0.3, at[1] + 0.8));
  }

  // 3 行目。それを見て、自分も試したくなった。X の作例と TANK SHOOT を並べる。
  function wantToTry(ctx, t, frame) {
    const p = easeInOut(span(t, at[2], at[2] + 0.9));
    const lw = lerp(1520, 820, p);
    const lh = lw * 9 / 16;
    const lx = lerp(200, 100, p);
    const ly = lerp(120, (H - lh) / 2, p);
    framed(ctx, lx, ly, lw, lh, () => fitImage(ctx, frame, lx, ly, lw, lh, { smooth: false }));
    chip(ctx, 'X  @rehan_shei', lx, ly + lh + 24, 1 - p);
    const rx = 1000;
    const ry = (H - 461) / 2;
    framed(ctx, rx, ry, 820, 461, () => fitImage(ctx, dotWide, rx, ry, 820, 461, { smooth: false }), { alpha: p });
    dotText(ctx, '→', 960, 540, { size: 72, align: 'center', alpha: p });
  }

  // 4 行目。爆発の大きさや揺れの強さは、言葉では決めにくい。
  function hardToSay(ctx, t) {
    bubble(ctx, 560, 220, 800, 140, span(t, at[3] + 0.1, at[3] + 0.6), { text: '？', size: 72 });
    [10, 16, 22].forEach((size, i) => icon(ctx, 'blast', 620 + i * 340, 680, size, { color: '#ffe14d', alpha: span(t, at[3] + 0.8 + i * 0.4, at[3] + 1.2 + i * 0.4) }));
  }

  // 5 行目。案を並べて動かせるページで、見比べて選ぶ。
  function compare(ctx, t, frames) {
    const pick = easeOut(span(t, at[5] - 1.6, at[5] - 1.0));
    frames.forEach((img, i) => {
      const x = 180 + (i % 2) * 800;
      const y = 120 + Math.floor(i / 2) * 440;
      const chosen = i === CHOSEN;
      framed(ctx, x, y, 760, 380, () => {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x, y, 760, 380);
      }, { color: chosen && pick > 0 ? colors.green : colors.muted, alpha: chosen ? 1 : lerp(1, 0.35, pick) });
      if (chosen) icon(ctx, 'check', x + 700, y + 60, 8, { alpha: pick });
    });
  }

  // 6 行目。着弾で画面が揺れ、一瞬だけ止まる。
  function impact(ctx, t, frame) {
    drawCamera(ctx, frame, camera(frame, 960, 540, 1), { smooth: false });
  }

  // 7 行目。当てた手応えが出た。メーターがもう一段上がる。
  function feel(ctx, t, frame) {
    impact(ctx, t, frame);
    ctx.fillStyle = 'rgba(4, 7, 5, 0.5)';
    ctx.fillRect(0, 0, W, H);
    funMeter(ctx, ['camera', 'blast'], W / 2 - 240, 660, {
      alpha: easeOut(span(t, at[6], at[6] + 0.4)),
      rise: span(t, at[6] + 0.6, at[6] + 1.4),
      drawIcon: (name, x, y, alpha) => icon(ctx, name, x, y, 6, { alpha, color: name === 'blast' ? '#ffe14d' : colors.green }),
    });
  }

  const scenes = [release, xPost, wantToTry, hardToSay, compare, impact, feel];

  return {
    duration,
    async prepare(t) {
      if (t >= at[1] && t < at[2]) return blizzard.at(t - at[1]);
      if (t >= at[2] && t < at[3]) return meteor.at(t - at[2]);
      if (t >= at[4] && t < at[5]) {
        const i = (Math.floor((t - at[4]) * 30) % FX_FRAMES) + 1;
        return Promise.all(FX.map(name => fxFrame(name, i)));
      }
      if (t >= at[5]) return laser.at(Math.min(t - at[5], laser.duration - 0.05));
      return null;
    },
    draw(ctx, t, frame) {
      let i = at.length - 1;
      while (i > 0 && t < at[i]) i -= 1;
      scenes[i](ctx, t, frame);
    },
  };
}
