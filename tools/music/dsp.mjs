// 楽曲レンダラーの信号処理部品。すべて 44.1 kHz の単純な関数で、乱数は種から作る。
export const SR = 44100;

/** 種つきの乱数。同じ種なら同じ曲が書き出される */
export const createRng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const midi = (name) => {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`Unknown note ${name}`);
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  return 12 * (Number(match[3]) + 1) + PITCH[match[1]] + accidental;
};
export const hz = (note) => 440 * 2 ** ((note - 69) / 12);
export const dbToGain = (db) => 10 ** (db / 20);

const blep = (t, dt) => {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
};
/** 帯域制限したのこぎり波。phase は 0..1 */
export const saw = (phase, dt) => 2 * phase - 1 - blep(phase, dt);
/** 帯域制限した矩形波。width はデューティ比 */
export const pulse = (phase, dt, width) => {
  const shifted = phase - width < 0 ? phase - width + 1 : phase - width;
  return (phase < width ? 1 : -1) + blep(phase, dt) - blep(shifted, dt);
};
export const tri = (phase) => 1 - 4 * Math.abs(phase - 0.5);

export const LP = 0, BP = 1, HP = 2;
/** Cytomic の TPT 状態変数フィルター。毎サンプル cutoff を変えても安定する */
export const createFilter = () => {
  let ic1 = 0, ic2 = 0;
  return (x, cutoff, q, mode) => {
    const g = Math.tan(Math.PI * Math.min(Math.max(cutoff, 10), SR * 0.45) / SR);
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    return mode === LP ? v2 : mode === BP ? v1 : x - k * v1 - v2;
  };
};

/** 指数カーブの ADSR。t は発音からの秒、gate は押さえている秒 */
export const adsr = (t, gate, a, d, s, r) => {
  const held = (x) => (x < a ? x / a : s + (1 - s) * Math.exp(-(x - a) / d));
  if (t <= gate) return held(t);
  return held(gate) * Math.exp(-(t - gate) / r);
};

export const createBus = (frames) => ({ L: new Float32Array(frames), R: new Float32Array(frames) });
/** 定パワーのパン。-1 が左、1 が右 */
export const panGains = (pan) => {
  const angle = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
  return [Math.cos(angle), Math.sin(angle)];
};

/**
 * 状態を持つ効果をループの 2 周ぶん通し、2 周目だけを書き戻す。
 * 1 周目の終わりの状態で 2 周目が始まるので、残響と遅延の尾が継ぎ目をまたいで先頭へ回り込む。
 */
export const processLoop = (bus, effect) => {
  const out = [0, 0];
  const frames = bus.L.length;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < frames; i++) {
      effect(bus.L[i], bus.R[i], out);
      if (pass === 1) { bus.L[i] = out[0]; bus.R[i] = out[1]; }
    }
  }
};

export const mixInto = (target, source, gain = 1) => {
  for (let i = 0; i < target.L.length; i++) {
    target.L[i] += source.L[i] * gain;
    target.R[i] += source.R[i] * gain;
  }
};
