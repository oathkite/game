// 送りと仕上げの効果。どれも processLoop で 2 周通す前提の (l, r, out) 形にする。
import { HP, SR, createFilter, dbToGain } from "./dsp.mjs";

const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES = [556, 441, 341, 225];
const SPREAD = 23;

const comb = (size, feedback, damp) => {
  const buffer = new Float32Array(size);
  let index = 0, store = 0;
  return (x) => {
    const y = buffer[index];
    store = y * (1 - damp) + store * damp;
    buffer[index] = x + store * feedback;
    index = index + 1 === size ? 0 : index + 1;
    return y;
  };
};
const allpass = (size) => {
  const buffer = new Float32Array(size);
  let index = 0;
  return (x) => {
    const y = buffer[index];
    buffer[index] = x + y * 0.5;
    index = index + 1 === size ? 0 : index + 1;
    return y - x;
  };
};

/** Freeverb。room は 0..1 で残響の長さ、damp は高域の吸い込み */
export const createReverb = ({ room = 0.82, damp = 0.35, width = 1 } = {}) => {
  const feedback = 0.7 + room * 0.28;
  const side = (offset) => ({
    combs: COMBS.map((size) => comb(size + offset, feedback, damp)),
    passes: ALLPASSES.map((size) => allpass(size + offset)),
  });
  const left = side(0), right = side(SPREAD);
  const run = (chain, x) => {
    let y = 0;
    for (const c of chain.combs) y += c(x);
    for (const p of chain.passes) y = p(y);
    return y;
  };
  const wet1 = (1 + width) / 2, wet2 = (1 - width) / 2;
  return (l, r, out) => {
    const input = (l + r) * 0.012;
    const a = run(left, input), b = run(right, input);
    out[0] = a * wet1 + b * wet2;
    out[1] = b * wet1 + a * wet2;
  };
};

/** 左右に跳ねる遅延。帰還路を一次の低域通過で丸め、繰り返すほど暗くする */
export const createPingPong = ({ samples, feedback = 0.38, tone = 0.3 }) => {
  const left = new Float32Array(samples), right = new Float32Array(samples);
  let index = 0, lpL = 0, lpR = 0;
  return (l, r, out) => {
    const dl = left[index], dr = right[index];
    lpL += (dl - lpL) * (1 - tone);
    lpR += (dr - lpR) * (1 - tone);
    left[index] = (l + r) * 0.5 + lpR * feedback;
    right[index] = lpL * feedback;
    index = index + 1 === samples ? 0 : index + 1;
    out[0] = dl;
    out[1] = dr;
  };
};

const coefficient = (seconds) => Math.exp(-1 / (seconds * SR));

/** 母線をまとめる緩い圧縮。ピーク検出、固定のメイクアップなし */
export const createCompressor = ({ thresholdDb = -14, ratio = 2.5, attack = 0.01, release = 0.18 } = {}) => {
  const threshold = dbToGain(thresholdDb);
  const att = coefficient(attack), rel = coefficient(release);
  let envelope = 0;
  return (l, r, out) => {
    const peak = Math.max(Math.abs(l), Math.abs(r));
    envelope = peak > envelope ? att * envelope + (1 - att) * peak : rel * envelope + (1 - rel) * peak;
    const gain = envelope > threshold ? (threshold * (envelope / threshold) ** (1 / ratio)) / envelope : 1;
    out[0] = l * gain;
    out[1] = r * gain;
  };
};

/** 先読みつきのピークリミッター。ceiling を超えるサンプルを出さない */
export const createLimiter = ({ ceilingDb = -1.8, lookahead = 0.004, release = 0.09 } = {}) => {
  const ceiling = dbToGain(ceilingDb);
  const delay = Math.round(lookahead * SR);
  const bufL = new Float32Array(delay), bufR = new Float32Array(delay);
  // 出ていくサンプルと先読みの全サンプルを含む窓にする
  const need = new Float32Array(delay + 1).fill(1);
  const rel = coefficient(release);
  const att = 1 - Math.exp(-4 / delay);
  let index = 0, needIndex = 0, gain = 1;
  return (l, r, out) => {
    const peak = Math.max(Math.abs(l), Math.abs(r));
    need[needIndex] = peak > ceiling ? ceiling / peak : 1;
    needIndex = needIndex + 1 === need.length ? 0 : needIndex + 1;
    let target = 1;
    for (let i = 0; i < need.length; i++) target = Math.min(target, need[i]);
    gain = target < gain ? gain + (target - gain) * att : rel * gain + (1 - rel) * target;
    out[0] = Math.max(-ceiling, Math.min(ceiling, bufL[index] * gain));
    out[1] = Math.max(-ceiling, Math.min(ceiling, bufR[index] * gain));
    bufL[index] = l;
    bufR[index] = r;
    index = index + 1 === delay ? 0 : index + 1;
  };
};

/** 聞こえない超低域を落とす 2 段の高域通過。音量の余裕を低域に食われないようにする */
export const createRumbleFilter = (cutoff = 30) => {
  const filters = [createFilter(), createFilter(), createFilter(), createFilter()];
  return (l, r, out) => {
    out[0] = filters[1](filters[0](l, cutoff, 0.54, HP), cutoff, 1.31, HP);
    out[1] = filters[3](filters[2](r, cutoff, 0.54, HP), cutoff, 1.31, HP);
  };
};

/** 真空管風の柔らかい歪み。drive を上げるほど倍音が増える */
export const saturate = (x, drive) => Math.tanh(x * drive) / Math.tanh(drive);
