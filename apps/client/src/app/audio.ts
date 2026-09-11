import type { WeaponSound } from "./weaponSounds";
import { createSampleAudio, type MusicName } from "./sampleAudio";

// Suno音源を再生し、取得前・取得失敗時は従来の合成音を使う。

export type SoundName = WeaponSound | "tick" | "fire" | "explosion" | "hit" | "hitConfirm" | "finish" | "matchFinish";

type AudioState = {
  ctx: AudioContext | null;
  /** 全部の音をまとめて通す圧縮器。着弾で 3 つまで重なる音が割れないようにする */
  master: DynamicsCompressorNode | null;
  output: GainNode | null;
  volume: number;
  muted: boolean;
};

const state: AudioState = { ctx: null, master: null, output: null, volume: 0.5, muted: false };

let samples: ReturnType<typeof createSampleAudio> | null = null;
let desiredMusic: MusicName | null = null;

export const setMusic = (name: MusicName | null): void => {
  desiredMusic = name;
  if (samples) void samples.setMusic(name);
};

export const setAudioActive = (active: boolean): void => {
  if (!state.ctx) return;
  void (active ? state.ctx.resume() : state.ctx.suspend()).catch(() => {});
};

/** 最初のユーザー操作で呼び、自動再生制限を解除する */
export const unlockAudio = (): void => {
  if (state.ctx) {
    if (state.ctx.state === "suspended") void state.ctx.resume().catch(() => {});
    if (samples) void samples.setMusic(desiredMusic);
    return;
  }
  if (typeof AudioContext === "undefined") return;
  let ctx: AudioContext;
  try { ctx = new AudioContext(); } catch { return; }
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -12;
  master.ratio.value = 8;
  master.attack.value = 0.002;
  master.release.value = 0.1;
  const output = ctx.createGain();
  output.gain.value = state.muted ? 0 : state.volume;
  master.connect(output);
  output.connect(ctx.destination);
  state.ctx = ctx;
  state.master = master;
  state.output = output;
  samples = createSampleAudio(ctx, master);
  void samples.preload();
  void samples.setMusic(desiredMusic);
};

export const setAudioSettings = (volume: number, muted: boolean): void => {
  state.volume = volume;
  state.muted = muted;
  if (state.ctx && state.output) state.output.gain.setValueAtTime(muted ? 0 : volume, state.ctx.currentTime);
};

type Tone = {
  readonly type: OscillatorType;
  readonly from: number;
  readonly to: number;
  readonly duration: number;
  readonly gain: number;
};

const TONES: Readonly<Record<SoundName, Tone>> = {
  "laser-fire": { type: "sawtooth", from: 2200, to: 180, duration: 0.24, gain: 0.18 },
  "laser-impact": { type: "triangle", from: 1200, to: 90, duration: 0.18, gain: 0.3 },
  "floater-fire": { type: "sine", from: 180, to: 780, duration: 0.5, gain: 0.4 },
  "floater-impact": { type: "sine", from: 650, to: 45, duration: 0.7, gain: 0.5 },
  "triple-fire": { type: "square", from: 550, to: 100, duration: 0.1, gain: 0.3 },
  "triple-impact": { type: "triangle", from: 200, to: 38, duration: 0.4, gain: 0.5 },
  "multiple-fire": { type: "square", from: 730, to: 130, duration: 0.08, gain: 0.25 },
  "multiple-impact": { type: "triangle", from: 264, to: 50, duration: 0.3, gain: 0.4 },
  "drill-fire": { type: "sawtooth", from: 300, to: 56, duration: 0.2, gain: 0.3 },
  "drill-impact": { type: "sawtooth", from: 112, to: 21, duration: 0.7, gain: 0.4 },
  "digger-fire": { type: "square", from: 374, to: 68, duration: 0.16, gain: 0.3 },
  "digger-impact": { type: "triangle", from: 136, to: 26, duration: 0.6, gain: 0.5 },
  "stinger-fire": { type: "sawtooth", from: 640, to: 116, duration: 0.14, gain: 0.25 },
  "stinger-impact": { type: "triangle", from: 232, to: 44, duration: 0.35, gain: 0.4 },
  matchFinish: { type: "triangle", from: 440, to: 880, duration: 0.5, gain: 0.3 },
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
  if (samples?.playEffect(name)) return;
  const tone = TONES[name];
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tone.type;
  osc.frequency.setValueAtTime(tone.from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.to), t0 + tone.duration);
  gain.gain.setValueAtTime(tone.gain, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + tone.duration);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + tone.duration + 0.02);
};
