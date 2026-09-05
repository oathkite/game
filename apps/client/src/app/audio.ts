// 設計書 03 の 3.8。Web Audio のオシレーターで 6 つの音を合成する。矩形波と三角波だけを使う。

export type SoundName = "tick" | "fire" | "explosion" | "hit" | "hitConfirm" | "finish";

type AudioState = {
  ctx: AudioContext | null;
  /** 全部の音をまとめて通す圧縮器。着弾で 3 つまで重なる音が割れないようにする */
  master: DynamicsCompressorNode | null;
  volume: number;
  muted: boolean;
};

const state: AudioState = { ctx: null, master: null, volume: 0.5, muted: false };

/** 最初のユーザー操作で呼び、自動再生制限を解除する */
export const unlockAudio = (): void => {
  if (state.ctx) {
    if (state.ctx.state === "suspended") void state.ctx.resume();
    return;
  }
  if (typeof AudioContext === "undefined") return;
  const ctx = new AudioContext();
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -12;
  master.ratio.value = 8;
  master.attack.value = 0.002;
  master.release.value = 0.1;
  master.connect(ctx.destination);
  state.ctx = ctx;
  state.master = master;
};

export const setAudioSettings = (volume: number, muted: boolean): void => {
  state.volume = volume;
  state.muted = muted;
};

type Tone = {
  readonly type: OscillatorType;
  readonly from: number;
  readonly to: number;
  readonly duration: number;
  readonly gain: number;
};

const TONES: Readonly<Record<SoundName, Tone>> = {
  tick: { type: "square", from: 1760, to: 1760, duration: 0.06, gain: 0.25 },
  fire: { type: "square", from: 440, to: 80, duration: 0.12, gain: 0.35 },
  explosion: { type: "triangle", from: 160, to: 30, duration: 0.5, gain: 0.6 },
  hit: { type: "square", from: 220, to: 110, duration: 0.3, gain: 0.4 },
  // 自分の弾が相手に入った手応え。上昇する短い音で、被弾の下降音と向きで区別する
  hitConfirm: { type: "square", from: 330, to: 660, duration: 0.09, gain: 0.35 },
  // この一撃で HP が尽きた。長く沈む音
  finish: { type: "triangle", from: 440, to: 55, duration: 0.9, gain: 0.5 },
};

export const playSound = (name: SoundName): void => {
  const ctx = state.ctx;
  const master = state.master;
  if (!ctx || !master || state.muted || state.volume <= 0) return;
  const tone = TONES[name];
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tone.type;
  osc.frequency.setValueAtTime(tone.from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.to), t0 + tone.duration);
  gain.gain.setValueAtTime(tone.gain * state.volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + tone.duration);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + tone.duration + 0.02);
};
