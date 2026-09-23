import { createChipMusic, type MusicName } from "./chipMusic";
import { createImpulse, createNoiseBuffer, playRecipe, type SfxGraph } from "./sfx";
import { SOUNDS, type SoundName } from "./soundRecipes";

// シーン別の BGM と、レイヤー合成の効果音。効果音は外部音源を取得せずにその場で作る。

export type { SoundName } from "./soundRecipes";

type AudioState = {
  ctx: AudioContext | null;
  /** 全部の効果音をまとめて通す圧縮器。着弾で重なる音が割れないようにする */
  master: DynamicsCompressorNode | null;
  output: GainNode | null;
  musicOutput: GainNode | null;
  /** 大きい着弾の瞬間だけ BGM を下げる段。音量設定とは別に持つ */
  musicDuck: GainNode | null;
  sfx: SfxGraph | null;
  bgmVolume: number;
  volume: number;
  muted: boolean;
};

const state: AudioState = { ctx: null, master: null, output: null, musicOutput: null, musicDuck: null, sfx: null, bgmVolume: 0.5, volume: 0.5, muted: false };

let music: ReturnType<typeof createChipMusic> | null = null;
let desiredMusic: MusicName | null = null;

export const setMusic = (name: MusicName | null): void => {
  desiredMusic = name;
  if (music) void music.setMusic(name);
};

export const setAudioActive = (active: boolean): void => {
  if (!state.ctx) return;
  void (active ? state.ctx.resume() : state.ctx.suspend()).catch(() => {});
};

const createEffectsChain = (ctx: AudioContext): void => {
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -14;
  master.knee.value = 8;
  master.ratio.value = 4;
  master.attack.value = 0.003;
  master.release.value = 0.25;
  const output = ctx.createGain();
  output.gain.value = state.muted ? 0 : state.volume;
  master.connect(output);
  output.connect(ctx.destination);
  state.master = master;
  state.output = output;
};

const createMusicChain = (ctx: AudioContext): GainNode => {
  const musicOutput = ctx.createGain();
  musicOutput.gain.value = state.muted ? 0 : state.bgmVolume;
  const musicDuck = ctx.createGain();
  musicOutput.connect(musicDuck);
  musicDuck.connect(ctx.destination);
  state.musicOutput = musicOutput;
  state.musicDuck = musicDuck;
  return musicOutput;
};

/** 爆発の尾を置く短い残響。効果音の圧縮器の手前へ戻す */
const createSfxGraph = (ctx: AudioContext, master: AudioNode): SfxGraph => {
  const space = ctx.createConvolver();
  space.buffer = createImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  space.connect(wet);
  wet.connect(master);
  return { ctx, output: master, space, noise: createNoiseBuffer(ctx) };
};

/** 最初のユーザー操作で呼び、自動再生制限を解除する */
export const unlockAudio = (): void => {
  if (state.ctx) {
    if (state.ctx.state === "suspended") void state.ctx.resume().catch(() => {});
    if (music) void music.setMusic(desiredMusic);
    return;
  }
  if (typeof AudioContext === "undefined") return;
  let ctx: AudioContext;
  try { ctx = new AudioContext(); } catch { return; }
  state.ctx = ctx;
  createEffectsChain(ctx);
  music = createChipMusic(ctx, createMusicChain(ctx));
  if (state.master) state.sfx = createSfxGraph(ctx, state.master);
  void music.setMusic(desiredMusic);
};

export const setAudioSettings = (volume: number, muted: boolean, bgmVolume = volume): void => {
  state.volume = volume;
  state.bgmVolume = bgmVolume;
  state.muted = muted;
  if (state.ctx && state.musicOutput) state.musicOutput.gain.setValueAtTime(muted ? 0 : bgmVolume, state.ctx.currentTime);
  if (state.ctx && state.output) state.output.gain.setValueAtTime(muted ? 0 : volume, state.ctx.currentTime);
};

const DUCK_HOLD = 0.12;
let activeDuck = { amount: 0, at: -Infinity };

/**
 * 着弾の瞬間に BGM を下げ、0.1 秒ほど置いてから戻す。音量は変えずに効果音を前へ出す。
 * 同じ瞬間に爆発と被弾が続くと後の浅い値で上書きされるので、下げている間は深いほうを保つ
 */
const duckMusic = (ctx: AudioContext, amount: number): void => {
  const duck = state.musicDuck;
  if (!duck || amount <= 0) return;
  const t = ctx.currentTime;
  if (t < activeDuck.at + DUCK_HOLD && amount <= activeDuck.amount) return;
  activeDuck = { amount, at: t };
  duck.gain.cancelScheduledValues(t);
  duck.gain.setTargetAtTime(1 - amount, t, 0.01);
  duck.gain.setTargetAtTime(1, t + DUCK_HOLD, 0.35);
};

const MOVE_INTERVAL = 0.075;
/** 同じ音がこの間隔より詰めて届いたら重ねない。同じ瞬間の多段着弾で音量が跳ねるのを防ぐ */
const RETRIGGER_INTERVAL = 0.03;
const lastPlayed = new Map<SoundName, number>();

export const playSound = (name: SoundName): void => {
  const { ctx, sfx } = state;
  if (!ctx || !sfx || state.muted || state.volume <= 0) return;
  const now = ctx.currentTime;
  const interval = name === "move" ? MOVE_INTERVAL : RETRIGGER_INTERVAL;
  if (now - (lastPlayed.get(name) ?? -Infinity) < interval) return;
  lastPlayed.set(name, now);
  const recipe = SOUNDS[name];
  playRecipe(sfx, recipe, now);
  duckMusic(ctx, recipe.duck ?? 0);
};
