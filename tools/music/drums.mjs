// 打楽器。音程を持たないので event.note は使わず、params で胴の高さを決める。
import { SR, BP, HP, LP, createFilter } from "./dsp.mjs";
import { saturate } from "./effects.mjs";
import { createPhase, placeMono } from "./voice.mjs";

const TAU = Math.PI * 2;
// 808 系の金属音に使う、互いに整数比にならない 6 本の矩形
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

const metallic = (scale) => {
  const phases = METAL.map(() => createPhase());
  return () => {
    let sum = 0;
    for (let i = 0; i < METAL.length; i++) sum += phases[i](METAL[i] * scale) < 0.5 ? 1 : -1;
    return sum / METAL.length;
  };
};

/** 胴の音程が急に落ちるキック。頭に短いクリックを足して小さい再生機でも聞こえるようにする */
export const kick = (bus, { at, vel }, p = {}, rng) => {
  const { tone = 47, punch = 3.2, decay = 0.32, click = 0.35, drive = 1.9 } = p;
  const body = createPhase(), filter = createFilter();
  placeMono(bus, at, decay * 5, 0, (t) => {
    const f = tone * (1 + punch * Math.exp(-t / 0.032));
    const y = Math.sin(TAU * body(f)) * Math.exp(-t / decay);
    const tick = filter(rng() * 2 - 1, 3000, 0.7, HP) * Math.exp(-t / 0.003) * click;
    return saturate(y + tick, drive) * vel;
  });
};

/** 胴鳴りと帯域を絞ったノイズを重ねたスネア */
export const snare = (bus, { at, vel, pan = 0 }, p = {}, rng) => {
  const { tone = 185, decay = 0.17, body = 0.5, snap = 2200, drive = 1.4 } = p;
  const a = createPhase(), b = createPhase(), band = createFilter(), high = createFilter();
  placeMono(bus, at, decay * 5, pan, (t) => {
    const shell = (Math.sin(TAU * a(tone)) + 0.5 * Math.sin(TAU * b(tone * 1.78))) * Math.exp(-t / 0.055) * body;
    const n = rng() * 2 - 1;
    const wires = (band(n, snap, 0.8, BP) + high(n, 5200, 0.7, HP) * 0.45) * Math.exp(-t / decay);
    return saturate(shell + wires * 1.3, drive) * vel;
  });
};

/** 閉じたハイハット。decay を伸ばせば開いた音になる */
export const hat = (bus, { at, vel, pan = 0 }, p = {}, rng) => {
  const { decay = 0.035, cutoff = 7600, metal = 0.5 } = p;
  const ring = metallic(1.7), high = createFilter();
  placeMono(bus, at, decay * 6, pan, (t) => {
    const y = high((rng() * 2 - 1) * (1 - metal) + ring() * metal, cutoff, 0.8, HP);
    return y * Math.min(1, t / 0.0006) * Math.exp(-t / decay) * vel * 0.7;
  });
};

/** 3 回の短い破裂と残響の尾で作る手拍子 */
export const clap = (bus, { at, vel, pan = 0 }, p = {}, rng) => {
  const { tone = 1400, decay = 0.13 } = p;
  const band = createFilter();
  placeMono(bus, at, 0.8, pan, (t) => {
    let env = Math.exp(-t / 0.004) + (t > 0.011 ? Math.exp(-(t - 0.011) / 0.004) : 0);
    if (t > 0.022) env += Math.exp(-(t - 0.022) / decay) * 0.9;
    return band(rng() * 2 - 1, tone, 1.1, BP) * env * vel * 1.6;
  });
};

/** 音程の下がる胴。tone を下げて decay を伸ばすと和太鼓に近づく */
export const tom = (bus, { at, vel, pan = 0 }, p = {}, rng) => {
  const { tone = 110, decay = 0.35, thump = 0.4, drive = 1.5 } = p;
  const body = createPhase(), low = createFilter();
  placeMono(bus, at, decay * 5, pan, (t) => {
    const f = tone * (1 + 0.55 * Math.exp(-t / 0.05));
    const y = Math.sin(TAU * body(f)) * Math.exp(-t / decay);
    const skin = low(rng() * 2 - 1, 900, 0.7, LP) * Math.exp(-t / 0.03) * thump;
    return saturate(y + skin, drive) * vel;
  });
};

/** クラッシュ。金属音とノイズを長く減衰させる */
export const crash = (bus, { at, vel, pan = 0 }, p = {}, rng) => {
  const { decay = 1.4, cutoff = 4200 } = p;
  const ring = metallic(2.6), high = createFilter(), band = createFilter();
  placeMono(bus, at, decay * 5, pan, (t) => {
    const n = rng() * 2 - 1;
    const y = high(n * 0.7 + ring() * 0.5, cutoff, 0.7, HP) + band(n, 9000, 1.2, BP) * 0.4;
    return y * Math.min(1, t / 0.001) * Math.exp(-t / decay) * vel * 0.5;
  });
};

/** 端末のクリック音。リムショットの代わりに使う */
export const rim = (bus, { at, vel, pan = 0 }, p = {}, rng) => {
  const { tone = 1750 } = p;
  const a = createPhase(), high = createFilter();
  placeMono(bus, at, 0.08, pan, (t) => {
    const y = Math.sin(TAU * a(tone)) * Math.exp(-t / 0.009) + high(rng() * 2 - 1, 4000, 0.7, HP) * Math.exp(-t / 0.002);
    return y * vel * 0.6;
  });
};

/** 高い帯域の短いノイズ。16 分で刻んで推進力を足す */
export const shaker = (bus, { at, vel, pan = 0 }, p = {}, rng) => {
  const { tone = 6500, decay = 0.045 } = p;
  const band = createFilter();
  placeMono(bus, at, decay * 6, pan, (t) => {
    const env = Math.min(1, t / 0.008) * Math.exp(-Math.max(0, t - 0.008) / decay);
    return band(rng() * 2 - 1, tone, 1.4, BP) * env * vel;
  });
};

/** 帯域が上がっていくノイズ。場面の切り替えに向けて持ち上げる */
export const sweep = (bus, { at, gate, vel, pan = 0 }, p = {}, rng) => {
  const { from = 300, to = 7000, q = 2 } = p;
  const band = createFilter();
  placeMono(bus, at, gate + 0.05, pan, (t) => {
    const x = Math.min(1, t / gate);
    const y = band(rng() * 2 - 1, from * (to / from) ** x, q, BP);
    return y * x * x * (t > gate ? Math.exp(-(t - gate) / 0.01) : 1) * vel;
  });
};

/** 石や鉄を叩いたような短い金属音 */
export const metal = (bus, { at, vel, pan = 0 }, p = {}) => {
  const { tone = 420, ratio = 1.414, index = 4, decay = 0.22 } = p;
  const c = createPhase(), m = createPhase();
  placeMono(bus, at, decay * 5, pan, (t) => {
    const mod = Math.sin(TAU * m(tone * ratio)) * index * Math.exp(-t / 0.05);
    return Math.sin(TAU * c(tone) + mod) * Math.min(1, t / 0.001) * Math.exp(-t / decay) * vel * 0.45;
  });
};

export const DRUMS = { kick, snare, hat, clap, tom, crash, rim, shaker, sweep, metal };
