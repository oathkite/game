// ITU-R BS.1770-4 の積分ラウドネス。ループなので 400 ms の窓は末尾から先頭へ回り込む。
import { SR } from "./dsp.mjs";

const biquad = ([b0, b1, b2, a1, a2]) => {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
};

/** libebur128 と同じ式で任意の標本化周波数の K 特性を作る */
const kWeighting = () => {
  const shelfK = Math.tan(Math.PI * 1681.974450955533 / SR);
  const vh = 10 ** (3.999843853973347 / 20), vb = vh ** 0.4996667741545416, q1 = 0.7071752369554196;
  const s0 = 1 + shelfK / q1 + shelfK * shelfK;
  const shelf = biquad([
    (vh + vb * shelfK / q1 + shelfK * shelfK) / s0, 2 * (shelfK * shelfK - vh) / s0,
    (vh - vb * shelfK / q1 + shelfK * shelfK) / s0, 2 * (shelfK * shelfK - 1) / s0,
    (1 - shelfK / q1 + shelfK * shelfK) / s0,
  ]);
  const highK = Math.tan(Math.PI * 38.13547087602444 / SR), q2 = 0.5003270373238773;
  const h0 = 1 + highK / q2 + highK * highK;
  const high = biquad([1, -2, 1, 2 * (highK * highK - 1) / h0, (1 - highK / q2 + highK * highK) / h0]);
  return (x) => high(shelf(x));
};

const weighted = (samples) => {
  const filter = kWeighting();
  // 1 周空回しして、フィルターの状態を継ぎ目に合わせる
  for (let i = 0; i < samples.length; i++) filter(samples[i]);
  return Float64Array.from(samples, (x) => { const y = filter(x); return y * y; });
};

export const integratedLoudness = (bus) => {
  const left = weighted(bus.L), right = weighted(bus.R);
  const frames = left.length, block = Math.round(0.4 * SR), hop = Math.round(0.1 * SR);
  const powers = [];
  for (let start = 0; start < frames; start += hop) {
    let sum = 0;
    for (let i = 0; i < block; i++) { const index = (start + i) % frames; sum += left[index] + right[index]; }
    powers.push(sum / block);
  }
  const lufs = (power) => -0.691 + 10 * Math.log10(power);
  const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  const absolute = powers.filter((power) => lufs(power) > -70);
  if (!absolute.length) return -Infinity;
  const relativeGate = lufs(mean(absolute)) - 10;
  const gated = absolute.filter((power) => lufs(power) > relativeGate);
  return lufs(mean(gated));
};

export const samplePeakDb = (bus) => {
  let peak = 0;
  for (let i = 0; i < bus.L.length; i++) peak = Math.max(peak, Math.abs(bus.L[i]), Math.abs(bus.R[i]));
  return 20 * Math.log10(peak);
};
