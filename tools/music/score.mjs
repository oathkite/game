// 曲を文字で書くための記法。1 step は 16 分音符。
import { midi } from "./dsp.mjs";

const VELOCITY = { "": 0.8, "!": 1, "?": 0.55 };

/**
 * 旋律と和音。"D4/2 A3/2 D4+F4/4! -/8" のように「音名/step 数」を空白で並べる。
 * 音名を + でつなぐと和音、- は休符、末尾の ! は強く、? は弱く弾く。
 */
export const phrase = (text) => {
  const events = [];
  let step = 0;
  for (const token of text.trim().split(/\s+/)) {
    const match = /^([^/]+)\/(\d+(?:\.\d+)?)([!?]?)$/.exec(token);
    if (!match) throw new Error(`Unreadable token "${token}"`);
    const steps = Number(match[2]);
    if (match[1] !== "-") events.push({ step, steps, notes: match[1].split("+").map(midi), vel: VELOCITY[match[3]] });
    step += steps;
  }
  return { events, steps: step };
};

const HIT = { x: [0.8], X: [1], g: [0.35], r: [0.5, 0.42] };
/** 打楽器の並び。1 文字が 1 step で、x 普通、X 強く、g ゴースト、r 32 分の 2 連打。空白と | は読みやすさのためだけに置ける */
export const beat = (text) => {
  const chars = text.replace(/[\s|]/g, "");
  const events = [];
  [...chars].forEach((char, step) => {
    if (char === ".") return;
    const hits = HIT[char];
    if (!hits) throw new Error(`Unknown hit "${char}"`);
    hits.forEach((vel, index) => events.push({ step: step + index / 2, steps: 1, notes: [], vel }));
  });
  return { events, steps: chars.length };
};

/**
 * 和音をアルペジオに崩す。pattern の数は和音の構成音の番号で、構成音の数を超えると 1 オクターブ上を指す。
 * rate は 1 音の step 数。
 */
export const arp = (chords, pattern, rate = 1) => {
  const source = phrase(chords);
  const events = [];
  let cursor = 0;
  for (const chord of source.events) {
    const size = chord.notes.length;
    for (let step = 0; step < chord.steps; step += rate) {
      const index = pattern[cursor++ % pattern.length];
      if (index === null) continue;
      const note = chord.notes[index % size] + 12 * Math.floor(index / size);
      events.push({ step: chord.step + step, steps: rate, notes: [note], vel: step % 4 === 0 ? 0.85 : 0.68 });
    }
  }
  return { events, steps: source.steps };
};

/** 音程をずらした写し。同じ動機を別の調で使う */
export const transpose = (part, semitones) => ({
  steps: part.steps,
  events: part.events.map((event) => ({ ...event, notes: event.notes.map((note) => note + semitones) })),
});

/** 複数の記譜を順につなぐ */
export const concat = (...parts) => {
  const events = [];
  let offset = 0;
  for (const part of parts) {
    for (const event of part.events) events.push({ ...event, step: event.step + offset });
    offset += part.steps;
  }
  return { events, steps: offset };
};
