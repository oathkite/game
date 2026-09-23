// 1 音を母線へ書き込む共通処理。ループの長さを超えた尾は先頭へ回り込ませる。
import { SR, panGains } from "./dsp.mjs";

/**
 * render(t, out) は発音からの秒 t の左右の値を out に入れる。
 * seconds は尾を含めた長さ。ループより長い音はループの長さで打ち切る。
 */
export const place = (bus, at, seconds, render) => {
  const frames = bus.L.length;
  const length = Math.min(frames, Math.ceil(seconds * SR));
  const out = [0, 0];
  let index = ((at % frames) + frames) % frames;
  for (let i = 0; i < length; i++) {
    render(i / SR, out);
    bus.L[index] += out[0];
    bus.R[index] += out[1];
    index = index + 1 === frames ? 0 : index + 1;
  }
};

/** 単音の値を定パワーで左右へ振り分ける */
export const placeMono = (bus, at, seconds, pan, render) => {
  const [gl, gr] = panGains(pan);
  place(bus, at, seconds, (t, out) => {
    const y = render(t);
    out[0] = y * gl;
    out[1] = y * gr;
  });
};

/** 周波数を積分する位相。毎サンプル周波数が変わっても連続する */
export const createPhase = () => {
  let phase = 0;
  return (frequency) => {
    const current = phase;
    phase += frequency / SR;
    phase -= Math.floor(phase);
    return current;
  };
};
