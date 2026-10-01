// 6 章「音楽は、任せきる」。Suno の曲はループがつながらなかったので、曲づくりを AI に任せた。
// 波形は実際の曲から取った値（assets/waveforms.json）。旋律は主題曲 ridgeline の楽譜の頭の 4 小節。
import {
  W, H, colors, span, easeOut, easeInOut, lerp, clip, camera, drawCamera, chip, chapterTitle,
  funMeter,
} from '../stage.js';
import { icon } from '../icons.js';

// tools/music/tracks/ridgeline.mjs の LEAD の最初の 4 小節。音名/16 分音符の数。
const MELODY = [
  'D4/2 A3/2 D4/4 F4/3 E4/1 C4/2 D4/2',
  'A4/6 G4/2 F4/4 E4/4',
  'D4/2 Bb3/2 D4/4 F4/3 G4/1 A4/4',
  'G4/6 F4/2 E4/4 C4/4',
].join(' ');
const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function notes(score) {
  let step = 0;
  return score.split(' ').map(token => {
    const [name, length] = token.split('/');
    const m = name.match(/^([A-G])(#|b)?(\d)$/);
    const pitch = SEMITONE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + Number(m[3]) * 12;
    const note = { pitch, start: step, length: Number(length) };
    step += note.length;
    return note;
  });
}

export async function build(cue) {
  const waves = await (await fetch('assets/waveforms.json')).json();
  const play = clip('assets/clips/promo-play', 343);
  const melody = notes(MELODY);
  const at = cue.lines.map(line => line.start);
  const duration = cue.duration + 0.6;

  // 波形を横一列（ring 0）か輪（ring 1）で描く。輪では継ぎ目が真上に来る。
  function waveShape(ctx, peaks, ring, { reveal = 1, color, cx, cy, radius, spin }) {
    const n = Math.floor(peaks.length * reveal);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const u = i / peaks.length;
      const amp = peaks[i] * 120;
      if (ring) {
        const angle = -Math.PI / 2 + u * Math.PI * 2 + spin;
        ctx.moveTo(cx + Math.cos(angle) * (radius - amp), cy + Math.sin(angle) * (radius - amp));
        ctx.lineTo(cx + Math.cos(angle) * (radius + amp), cy + Math.sin(angle) * (radius + amp));
      } else {
        const x = 160 + u * 1600;
        ctx.moveTo(x, cy - amp);
        ctx.lineTo(x, cy + amp);
      }
    }
    ctx.stroke();
  }

  // 横一列から輪へは、縮めながら入れ替える。
  function wave(ctx, peaks, { bend = 0, reveal = 1, color = colors.green, cx = W / 2, cy = 560, radius = 300, spin = 0 }) {
    ctx.save();
    if (bend < 1) {
      ctx.globalAlpha = 1 - bend;
      waveShape(ctx, peaks, false, { reveal, color, cx, cy, radius, spin });
    }
    if (bend > 0) {
      ctx.globalAlpha = bend;
      ctx.translate(cx, cy);
      ctx.scale(lerp(1.4, 1, bend), lerp(1.4, 1, bend));
      ctx.translate(-cx, -cy);
      waveShape(ctx, peaks, true, { reveal: 1, color, cx, cy, radius, spin });
    }
    ctx.restore();
  }

  // 1〜2 行目。Suno の曲。ループさせるには、終わりと始まりがつながっている必要がある。
  function suno(ctx, t) {
    chapterTitle(ctx, 6, '音楽は、任せきる', t);
    chip(ctx, 'Suno', 160, 260, span(t, at[0] + 0.2, at[0] + 0.6));
    const reveal = easeOut(span(t, at[0] + 0.3, at[0] + 2.2));
    const bend = easeInOut(span(t, at[1] + 0.8, at[1] + 2.6));
    wave(ctx, waves.suno.peaks, { bend, reveal, color: colors.text });
    // 継ぎ目に印を付ける。
    const mark = span(t, at[1] + 3.0, at[1] + 3.6);
    if (mark > 0) {
      ctx.save();
      ctx.globalAlpha = mark;
      ctx.strokeStyle = colors.muted;
      ctx.lineWidth = 6;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 560 - 300 - 160);
      ctx.lineTo(W / 2, 560 - 300 + 160);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 3 行目。終わりは小さく消え、始まりは大きい。そのままつなぐと段差になる。右に拡大して見せる。
  function seam(ctx, t) {
    ctx.save();
    ctx.translate(-360, 0);
    suno(ctx, at[2] - 0.01);
    ctx.restore();
    const p = easeOut(span(t, at[2] + 0.2, at[2] + 0.8));
    ctx.save();
    ctx.globalAlpha = p;
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 4;
    ctx.strokeRect(1180, 260, 560, 600);
    ctx.fillStyle = colors.text;
    const base = 800;
    const tail = waves.suno.tailRms * 6000;
    const head = waves.suno.headRms * 6000;
    ctx.fillRect(1260, base - tail, 160, tail);
    ctx.fillRect(1500, base - head, 160, head);
    ctx.strokeStyle = colors.alert;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(1420, base - tail);
    ctx.lineTo(1460, base - tail);
    ctx.lineTo(1460, base - head);
    ctx.lineTo(1500, base - head);
    ctx.stroke();
    ctx.restore();
    // 輪の継ぎ目から拡大の枠へ線を引く。
    ctx.save();
    ctx.globalAlpha = p;
    ctx.strokeStyle = colors.muted;
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 360, 260);
    ctx.lineTo(1180, 260);
    ctx.stroke();
    ctx.restore();
    icon(ctx, 'cross', 1460, 400, 12, { color: colors.alert, alpha: span(t, at[2] + 1.0, at[2] + 1.4) });
  }

  // 4 行目。曲づくりを AI に任せる。
  function handOver(ctx, t) {
    const p = easeOut(span(t, at[3] + 0.1, at[3] + 0.7));
    icon(ctx, 'ai', 760, 540, 22, { alpha: p });
    icon(ctx, 'note', 1160, 540, 22, { alpha: easeOut(span(t, at[3] + 0.8, at[3] + 1.4)) });
  }

  // 5 行目。AI が楽譜にあたるものを書き、そこから音を書き出す。主題曲の旋律を鍵盤の譜面で描く。
  function score(ctx, t) {
    const total = melody.at(-1).start + melody.at(-1).length;
    const reveal = span(t, at[4] + 0.2, at[4] + 3.0);
    const lo = 45;
    const hi = 70;
    melody.forEach(n => {
      const x = 160 + (n.start / total) * 1600;
      if ((n.start / total) > reveal) return;
      const y = 820 - ((n.pitch - lo) / (hi - lo)) * 560;
      ctx.fillStyle = colors.green;
      ctx.fillRect(x, y, (n.length / total) * 1600 - 6, 22);
    });
    icon(ctx, 'ai', 140, 180, 8, { alpha: span(t, at[4], at[4] + 0.4) });
  }

  // 6 行目。最初からループする前提で作るので、継ぎ目がない。主題曲の波形を輪にして回す。
  function seamless(ctx, t) {
    const bend = easeInOut(span(t, at[5] + 0.2, at[5] + 1.6));
    const spin = Math.max(0, t - at[5] - 1.6) * 0.6;
    wave(ctx, waves.ridgeline.peaks, { bend, spin });
    icon(ctx, 'check', W / 2, 560, 16, { alpha: span(t, at[5] + 2.0, at[5] + 2.4) });
  }

  // 7 行目。音楽をつけると、対戦している雰囲気が出た。メーターが三段目に上がる。
  function atmosphere(ctx, t, frame) {
    drawCamera(ctx, frame, camera(frame, 960, 540, 1), { smooth: false });
    ctx.fillStyle = 'rgba(4, 7, 5, 0.5)';
    ctx.fillRect(0, 0, W, H);
    funMeter(ctx, ['camera', 'blast', 'note'], W / 2 - 240, 660, {
      alpha: easeOut(span(t, at[6] + 0.8, at[6] + 1.2)),
      rise: span(t, at[6] + 1.4, at[6] + 2.2),
      drawIcon: (name, x, y, alpha) => icon(ctx, name, x, y, 6, { alpha, color: name === 'blast' ? '#ffe14d' : colors.green }),
    });
  }

  const scenes = [suno, suno, seam, handOver, score, seamless, atmosphere];

  return {
    duration,
    async prepare(t) {
      if (t >= at[6]) return play.at(2 + t - at[6]);
      return null;
    },
    draw(ctx, t, frame) {
      let i = at.length - 1;
      while (i > 0 && t < at[i]) i -= 1;
      scenes[i](ctx, t, frame);
    },
  };
}
