// 音程を持つ楽器。どれも (bus, event, params, rng) で 1 音を書く。
import { SR, LP, adsr, createFilter, hz, pulse, saw, tri } from "./dsp.mjs";
import { saturate } from "./effects.mjs";
import { createPhase, place, placeMono } from "./voice.mjs";

const TAU = Math.PI * 2;
const cents = (value) => 2 ** (value / 1200);

/** アナログ風の単音ベース。のこぎりと矩形を重ね、フィルターの開きで弾く */
export const bass = (bus, { at, gate, note, vel }, p = {}) => {
  const { cutoff = 200, sweep = 1300, decay = 0.14, q = 0.9, drive = 1.8, sub = 0.5, width = 0.5 } = p;
  const f = hz(note), dt = f / SR;
  const a = createPhase(), b = createPhase(), c = createPhase(), filter = createFilter();
  placeMono(bus, at, gate + 0.3, 0, (t) => {
    const raw = saw(a(f), dt) * 0.6 + pulse(b(f * cents(7)), dt, width) * 0.4;
    const shaped = filter(raw, cutoff + sweep * vel * Math.exp(-t / decay), q, LP);
    const low = Math.sin(TAU * c(f)) * sub;
    return saturate(shaped + low, drive) * adsr(t, gate, 0.003, 0.3, 0.72, 0.05) * vel;
  });
};

/** 細いパルスの撥弦。アルペジオ用で、遅延に送って奥行きを出す */
export const pluck = (bus, { at, gate, note, vel, pan = 0 }, p = {}) => {
  const { width = 0.25, bright = 5200, decay = 0.065, tail = 0.16, q = 1.1 } = p;
  const f = hz(note), dt = f / SR;
  const a = createPhase(), b = createPhase(), filter = createFilter();
  placeMono(bus, at, gate + tail * 5, pan, (t) => {
    const raw = pulse(a(f), dt, width) * 0.6 + pulse(b(f * cents(-6)), dt, 0.5) * 0.3;
    const y = filter(raw, 500 + bright * vel * Math.exp(-t / decay), q, LP);
    return y * adsr(t, gate, 0.001, tail, 0, 0.05) * vel;
  });
};

/** ずらした 3 本ののこぎりを左右に開いたパッド */
export const pad = (bus, { at, gate, note, vel }, p = {}) => {
  const { cutoff = 1400, attack = 0.6, release = 1.1, lfo = 0.17, detune = 9 } = p;
  const f = hz(note), dt = f / SR;
  const phases = [createPhase(), createPhase(), createPhase()];
  const left = createFilter(), right = createFilter();
  place(bus, at, gate + release * 5, (t, out) => {
    const v0 = saw(phases[0](f * cents(-detune)), dt);
    const v1 = saw(phases[1](f), dt);
    const v2 = saw(phases[2](f * cents(detune)), dt);
    const moving = cutoff * (1 + 0.3 * Math.sin(TAU * lfo * t));
    const env = adsr(t, gate, attack, 1.2, 0.85, release) * vel * 0.33;
    out[0] = left(v0 + v1 * 0.5, moving, 0.7, LP) * env;
    out[1] = right(v2 + v1 * 0.5, moving, 0.7, LP) * env;
  });
};

/** 主旋律。遅れてかかるビブラートと、弾いた瞬間だけ明るいフィルター */
export const lead = (bus, { at, gate, note, vel, pan = 0 }, p = {}) => {
  const { cutoff = 1800, bright = 2600, width = 0.4, vibrato = 0.006, drive = 1.3 } = p;
  const f = hz(note), dt = f / SR;
  const a = createPhase(), b = createPhase(), filter = createFilter();
  placeMono(bus, at, gate + 0.7, pan, (t) => {
    const depth = vibrato * Math.min(1, Math.max(0, (t - 0.18) / 0.3));
    const g = f * (1 + depth * Math.sin(TAU * 5.4 * t));
    const raw = saw(a(g), dt) * 0.55 + pulse(b(g * cents(4)), dt, width) * 0.45;
    const y = filter(raw, cutoff + bright * Math.exp(-t / 0.25), 1.2, LP);
    return saturate(y, drive) * adsr(t, gate, 0.012, 0.35, 0.72, 0.12) * vel * 0.8;
  });
};

/** 2 演算子の FM 鐘。ratio が整数から離れるほど金属的になる */
export const bell = (bus, { at, gate, note, vel, pan = 0 }, p = {}) => {
  const { ratio = 3.5, index = 2.2, fall = 0.35, decay = 1.1 } = p;
  const f = hz(note);
  const c = createPhase(), m = createPhase();
  placeMono(bus, at, Math.max(gate, decay * 5), pan, (t) => {
    const mod = Math.sin(TAU * m(f * ratio)) * index * Math.exp(-t / fall);
    const y = Math.sin(TAU * c(f) + mod);
    return y * Math.min(1, t / 0.002) * Math.exp(-t / decay) * vel * 0.5;
  });
};

/** FM の電気ピアノ。低い倍率の胴鳴りに、高い倍率の爪音を短く足す */
export const keys = (bus, { at, gate, note, vel, pan = 0 }, p = {}) => {
  const { index = 1.6, tine = 0.8 } = p;
  const f = hz(note);
  const c = createPhase(), m = createPhase(), n = createPhase();
  placeMono(bus, at, gate + 1.5, pan, (t) => {
    const mod = Math.sin(TAU * m(f)) * index * vel * Math.exp(-t / 0.5)
      + Math.sin(TAU * n(f * 14)) * tine * Math.exp(-t / 0.018);
    return Math.sin(TAU * c(f) + mod) * adsr(t, gate, 0.002, 1.1, 0.35, 0.3) * vel * 0.45;
  });
};

/** 三角波と正弦波の持続音。低い土台に使う */
export const drone = (bus, { at, gate, note, vel }, p = {}) => {
  const { attack = 0.8, release = 1.5 } = p;
  const f = hz(note);
  const a = createPhase(), b = createPhase();
  placeMono(bus, at, gate + release * 5, 0, (t) => {
    const y = tri(a(f)) * 0.6 + Math.sin(TAU * b(f * 2.001)) * 0.25;
    return y * adsr(t, gate, attack, 2, 0.9, release) * vel;
  });
};

/** 水中の探信音。音程が少し下がりながら長く鳴る */
export const sonar = (bus, { at, note, vel, pan = 0 }) => {
  const f = hz(note);
  const a = createPhase();
  placeMono(bus, at, 2.4, pan, (t) => {
    const y = Math.sin(TAU * a(f * (1 - 0.02 * Math.min(1, t / 1.2))));
    return y * Math.min(1, t / 0.004) * Math.exp(-t / 0.45) * vel * 0.5;
  });
};

export const TONAL = { bass, pluck, pad, lead, bell, keys, drone, sonar };
