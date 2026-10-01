// 4 章「絵は、ドットで描き直す」。生成画像の三つの崩れを見せてから、ドット絵に置き換える。
import {
  W, H, span, easeInOut, easeOut, lerp, loadImage, camera, drawCamera, lerpCamera,
  ring, chip, chapterTitle, pixelate,
} from '../stage.js';

const CLIP_FPS = 30;
const CLIP_FRAMES = 162;

export async function build(cue) {
  const [battle, crater, pilots, dotWide, ...clip] = await Promise.all([
    loadImage('assets/gen-battle.png'),
    loadImage('assets/gen-crater.png'),
    loadImage('assets/gen-pilot-checker.png'),
    loadImage('assets/dot-wide.png'),
    ...Array.from({ length: CLIP_FRAMES }, (_, i) => loadImage(`assets/ch4-clip/${String(i + 1).padStart(3, '0')}.jpg`)),
  ]);
  const at = cue.lines.map(line => line.start);
  const duration = cue.duration + 0.6;

  // 生成画像の対戦画面。ゆっくり寄る。
  function showBattle(ctx, t) {
    const p = span(t, 0, at[1]);
    drawCamera(ctx, battle, camera(battle, 720, 450, lerp(1, 1.06, p)));
    chip(ctx, 'GPT Image 2.5', 64, H - 300, span(t, 1.0, 1.5));
    chapterTitle(ctx, 4, '絵は、ドットで描き直す', t);
  }

  // 「品質が安定しない」。三つの崩れの場所に印を付ける。
  function markProblems(ctx, t) {
    const cam = camera(crater, 720, 450, 1);
    drawCamera(ctx, crater, cam);
    const spots = [[725, 425, 90], [1250, 640, 110], [842, 505, 120]];
    spots.forEach(([x, y, r], i) => ring(ctx, ...cam.at(x, y), r, span(t, at[1] + 0.4 + i * 0.6, at[1] + 1.2 + i * 0.6), t));
  }

  // 透過を頼んでも、透過を表す市松模様が絵として描き込まれ、輪郭のまわりで模様が崩れる。
  function showFringe(ctx, t) {
    const p = easeInOut(span(t, at[2] + 0.3, at[3] - 0.4));
    const cam = lerpCamera(pilots, [687, 572, 1], [1150, 440, 4.2], p);
    drawCamera(ctx, pilots, cam, { smooth: false });
    ring(ctx, ...cam.at(1150, 440), 330, span(t, at[3] - 1.2, at[3] - 0.5), t);
  }

  // 拡大するとぼやける。なめらかに補間したまま岩肌に寄る。
  function showBlur(ctx, t) {
    const p = easeInOut(span(t, at[3] + 0.2, at[4] - 0.3));
    drawCamera(ctx, battle, lerpCamera(battle, [720, 450, 1], [1210, 600, 6], p), { smooth: true });
  }

  // えぐれた跡だけがなめらかな円で切り抜かれている。
  function showCrater(ctx, t) {
    const p = easeInOut(span(t, at[4] + 0.2, at[4] + 2.2));
    const cam = lerpCamera(crater, [720, 450, 1], [842, 505, 2.4], p);
    drawCamera(ctx, crater, cam);
    ring(ctx, ...cam.at(842, 505), 230, span(t, at[4] + 2.4, at[4] + 3.2), t);
  }

  // 生成画像をドットに崩し、そのままドット絵の画面に置き換える。
  function toDots(ctx, t) {
    const cam = camera(crater, 842, 505, 2.4);
    const crumble = span(t, at[5] + 0.2, at[5] + 1.6);
    const swap = span(t, at[5] + 1.4, at[5] + 2.2);
    pixelate(ctx, crater, cam, Math.round(lerp(1, 40, easeOut(crumble))));
    drawCamera(ctx, dotWide, camera(dotWide, 960, 540, lerp(1.08, 1, easeOut(swap))), { smooth: false, alpha: swap });
  }

  // 拡大しても点が大きくなるだけ。補間を切って戦車に寄る。
  function zoomDots(ctx, t) {
    const p = easeInOut(span(t, at[6] + 0.2, at[7] - 0.4));
    drawCamera(ctx, dotWide, lerpCamera(dotWide, [960, 540, 1], [845, 655, 4.5], p), { smooth: false });
  }

  // 削れた跡も同じ点で描かれる。着弾から跡が残るまでを流し、最後に少し寄る。
  function showDotCrater(ctx, t) {
    const index = Math.min(CLIP_FRAMES - 1, Math.floor((t - at[7]) * CLIP_FPS));
    const frame = clip[Math.max(0, index)];
    const p = easeInOut(span(t, at[7] + CLIP_FRAMES / CLIP_FPS - 0.6, duration));
    drawCamera(ctx, frame, lerpCamera(frame, [960, 540, 1], [960, 700, 1.6], p), { smooth: false });
  }

  const scenes = [showBattle, markProblems, showFringe, showBlur, showCrater, toDots, zoomDots, showDotCrater];

  return {
    duration,
    draw(ctx, t) {
      let i = at.length - 1;
      while (i > 0 && t < at[i]) i -= 1;
      scenes[i](ctx, t);
    },
  };
}
