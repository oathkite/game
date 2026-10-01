// 2 章「カメラを寄せる」。全体を収めた画面ではスマートフォンで戦車が小さすぎるので、カメラで寄せた。
import {
  W, H, colors, span, easeOut, easeInOut, lerp, loadImage, clip, camera, drawCamera, lerpCamera,
  ring, chapterTitle, funMeter, framed, fitImage, dotText,
} from '../stage.js';
import { icon } from '../icons.js';

// 地形スケッチの「谷」（400×225 セル）と、2 台の位置（セル）。
const SPAWNS = [[75, 122], [325, 122]];

export async function build(cue) {
  const valley = await loadImage('assets/maps/0.png');
  const zoomOut = clip('assets/clips/promo-zoomout', 115);
  const follow = clip('assets/clips/promo-follow', 115);
  const at = cue.lines.map(line => line.start);
  const duration = cue.duration + 0.6;

  // 地形の上に戦車を 7×5 セルの四角で置いた、最初のころの全体表示。
  const field = document.createElement('canvas');
  field.width = 400;
  field.height = 225;
  const fctx = field.getContext('2d');
  fctx.drawImage(valley, 0, 0);
  SPAWNS.forEach(([x, y], i) => {
    fctx.fillStyle = i === 0 ? '#ff4040' : '#4d7cff';
    fctx.fillRect(x - 3, y - 5, 7, 4);
    fctx.fillStyle = '#ffe14d';
    fctx.fillRect(x - 1, y - 7, 3, 2);
  });

  // 1 行目。マップ全体が常に画面に収まっていた。
  function wholeMap(ctx, t) {
    drawCamera(ctx, field, camera(field, 200, 112.5, 1), { smooth: false });
    chapterTitle(ctx, 2, 'カメラを寄せる', t);
  }

  // 2〜3 行目。スマートフォンの画面に入れると戦車が小さい。だから戦車に寄せたい。
  function onPhone(ctx, t) {
    const shrink = easeInOut(span(t, at[1], at[1] + 0.8));
    const pw = lerp(W, 1100, shrink);
    const ph = pw * 9 / 16;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    const zoom = easeInOut(span(t, at[2] + 0.2, at[3] - 0.5));
    const cam = lerpCamera(field, [200, 112.5, 1], [SPAWNS[0][0] + 8, SPAWNS[0][1] - 6, 5], zoom);
    // 画面の枠をスマートフォンの縁に見立てる。
    ctx.fillStyle = '#1a1f1c';
    ctx.fillRect(px - 60 * shrink, py - 40 * shrink, pw + 120 * shrink, ph + 80 * shrink);
    framed(ctx, px, py, pw, ph, () => {
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(pw / W, ph / H);
      drawCamera(ctx, field, cam, { smooth: false });
      ctx.restore();
    }, { color: '#2c3530' });
    const [tx, ty] = cam.at(SPAWNS[0][0], SPAWNS[0][1] - 3);
    ring(ctx, px + tx * pw / W, py + ty * ph / H, 70, span(t, at[1] + 1.6, at[1] + 2.4) * (1 - zoom), t);
  }

  // 4 行目。ポトリスもそういう見せ方だった。
  function likePotoris(ctx, t, frame) {
    onPhone(ctx, at[3] - 0.01);
    ctx.fillStyle = 'rgba(4, 7, 5, 0.75)';
    ctx.fillRect(0, 0, W, H);
    const p = easeOut(span(t, at[3] + 0.2, at[3] + 0.8));
    const size = 34;
    icon(ctx, 'crt', W / 2, 560, size, { color: colors.muted, light: '#2b3d33', alpha: p });
    ctx.save();
    ctx.globalAlpha = p;
    ctx.fillStyle = '#06100a';
    ctx.fillRect(W / 2 - 4 * size, 560 - 4 * size, 8 * size, 4 * size);
    ctx.restore();
    dotText(ctx, 'ポトリス 2', W / 2, 560 - 2 * size, { size: 44, alpha: p, align: 'center' });
    icon(ctx, 'check', W / 2 + 330, 520, 14, { alpha: span(t, at[3] + 1.2, at[3] + 1.6) });
  }

  // 5 行目。AI にカメラを入れてもらい、戦車に寄せる。引いていく映像を逆に流して寄っていく。
  function addCamera(ctx, t, frame) {
    drawCamera(ctx, frame, camera(frame, 960, 540, 1), { smooth: false });
    const p = easeOut(span(t, at[4] + 0.1, at[4] + 0.6)) * (1 - span(t, at[5] - 0.8, at[5] - 0.3));
    ctx.save();
    ctx.globalAlpha = p * 0.85;
    ctx.fillStyle = colors.ground;
    ctx.fillRect(64, 64, 300, 260);
    ctx.restore();
    icon(ctx, 'camera', 214, 194, 18, { alpha: p });
  }

  // 6 行目。弾を追って画面が動く。
  function followShot(ctx, t, frame) {
    drawCamera(ctx, frame, camera(frame, 960, 540, 1), { smooth: false });
  }

  // 7 行目。ここで初めて楽しいと感じた。メーターが一段上がる。
  function firstFun(ctx, t, frame) {
    followShot(ctx, t, frame);
    ctx.fillStyle = 'rgba(4, 7, 5, 0.5)';
    ctx.fillRect(0, 0, W, H);
    funMeter(ctx, ['camera'], W / 2 - 240, 660, {
      alpha: easeOut(span(t, at[6], at[6] + 0.4)),
      rise: span(t, at[6] + 0.6, at[6] + 1.4),
      drawIcon: (name, x, y, alpha) => icon(ctx, name, x, y, 6, { alpha }),
    });
  }

  const scenes = [wholeMap, onPhone, onPhone, likePotoris, addCamera, followShot, firstFun];

  return {
    duration,
    async prepare(t) {
      if (t >= at[4] && t < at[5]) {
        // 引いていく映像（3.8 秒）を、カメラの話の長さに合わせて逆に流す。
        const p = span(t, at[4] + 0.6, at[5] - 0.2);
        return zoomOut.at((1 - p) * (zoomOut.duration - 0.05));
      }
      if (t >= at[5]) return follow.at(Math.min(t - at[5], follow.duration - 0.05));
      return null;
    },
    draw(ctx, t, frame) {
      let i = at.length - 1;
      while (i > 0 && t < at[i]) i -= 1;
      scenes[i](ctx, t, frame);
    },
  };
}
