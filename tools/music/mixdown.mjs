// 1 曲の記譜を、ループ 1 周ぶんのステレオ母線に書き出す。
import { SR, createBus, createRng, dbToGain, mixInto, processLoop } from "./dsp.mjs";
import { createCompressor, createLimiter, createPingPong, createReverb, createRumbleFilter } from "./effects.mjs";
import { integratedLoudness, samplePeakDb } from "./loudness.mjs";
import { TONAL } from "./instruments.mjs";
import { DRUMS } from "./drums.mjs";

export const TARGET_LUFS = -13.5;
// Vorbis の符号化とサンプル間のピークで 1.5 dB ほど上振れするので、旧曲と同じ -1.4 dBTP 付近に収まる天井にする
export const CEILING_DB = -3;
const GLUE_LUFS = -16;

/** 1 小節が整数サンプルになる BPM だけを許す。ループの終わりを丸めずに済む */
export const loopFrames = (track) => {
  const bar = SR * 240 / track.bpm;
  if (!Number.isInteger(bar)) throw new Error(`${track.name}: ${track.bpm} BPM does not give whole-sample bars`);
  return bar * track.bars;
};

/**
 * 記譜を曲の頭から繰り返し敷き詰め、from..to 小節に入る音だけを返す。
 * 頭を基準にするので、曲全体の和音に沿った記譜を途中の小節から鳴らしてもずれない。
 */
export const expand = (layer, bars) => {
  const from = (layer.from ?? 0) * 16, to = (layer.to ?? bars) * 16;
  const hits = [];
  for (let offset = Math.floor(from / layer.part.steps) * layer.part.steps; offset < to; offset += layer.part.steps) {
    for (const event of layer.part.events) {
      const step = offset + event.step;
      if (step >= from && step < to) hits.push({ ...event, step });
    }
  }
  return hits;
};

const defaultBus = (inst) => (inst in DRUMS ? "drums" : inst === "bass" || inst === "drone" ? "bass" : "music");

export const renderLayer = (scratch, layer, track, rng) => {
  const instrument = TONAL[layer.inst] ?? DRUMS[layer.inst];
  if (!instrument) throw new Error(`${track.name}: unknown instrument ${layer.inst}`);
  const stepFrames = SR * 15 / track.bpm;
  expand(layer, track.bars).forEach((hit, index) => {
    const swing = Math.floor(hit.step) % 2 === 1 ? track.swing ?? 0 : 0;
    const at = Math.round((hit.step + swing) * stepFrames);
    const gate = hit.steps * stepFrames / SR * (layer.legato ?? 0.9);
    const vel = hit.vel * (1 - (layer.humanize ?? 0) * rng());
    const pan = Array.isArray(layer.pan) ? layer.pan[index % layer.pan.length] : layer.pan ?? 0;
    if (layer.inst in DRUMS) instrument(scratch, { at, gate, vel, pan }, layer.params, rng);
    else for (const note of hit.notes) instrument(scratch, { at, gate, note: note + (layer.transpose ?? 0), vel, pan }, layer.params, rng);
  });
};

/** キックの直後だけベースと上物を下げる。3 ms かけて下げ、クリックを出さない */
const duckCurve = (track, frames) => {
  const curve = new Float32Array(frames).fill(1);
  const { depth = 0, release = 0.12 } = track.duck ?? {};
  if (depth <= 0) return curve;
  const stepFrames = SR * 15 / track.bpm, length = Math.round(release * 5 * SR), attack = 0.003 * SR;
  for (const layer of track.layers.filter((item) => item.inst === "kick")) {
    for (const hit of expand(layer, track.bars)) {
      const at = Math.round(hit.step * stepFrames);
      for (let j = 0; j < length; j++) {
        const index = (at + j) % frames;
        const value = 1 - depth * hit.vel * Math.min(1, j / attack) * Math.exp(-j / (release * SR));
        if (value < curve[index]) curve[index] = value;
      }
    }
  }
  return curve;
};

const applyCurve = (bus, curve) => {
  for (let i = 0; i < curve.length; i++) { bus.L[i] *= curve[i]; bus.R[i] *= curve[i]; }
};

/**
 * 層の音量は、その層だけを鳴らしたときの積分ラウドネス（level、LUFS）で指定する。
 * 楽器ごとの出力の大小に左右されず、曲をまたいで同じ釣り合いを保てる。
 */
export const layerGain = (bus, layer) => {
  if (layer.level === undefined) return layer.gain ?? 1;
  const measured = integratedLoudness(bus);
  return Number.isFinite(measured) ? dbToGain(layer.level - measured) : 0;
};

const renderGroups = (track, frames) => {
  const rng = createRng(track.seed);
  const groups = { drums: createBus(frames), bass: createBus(frames), music: createBus(frames), reverb: createBus(frames), delay: createBus(frames) };
  const scratch = createBus(frames);
  for (const layer of track.layers) {
    scratch.L.fill(0); scratch.R.fill(0);
    renderLayer(scratch, layer, track, rng);
    const gain = layerGain(scratch, layer);
    mixInto(groups[layer.bus ?? defaultBus(layer.inst)], scratch, gain);
    if (layer.reverb) mixInto(groups.reverb, scratch, gain * layer.reverb);
    if (layer.delay) mixInto(groups.delay, scratch, gain * layer.delay);
  }
  return groups;
};

const renderReturns = (track, groups) => {
  const stepFrames = SR * 15 / track.bpm;
  const { steps = 3, feedback = 0.38, tone = 0.3, gain = 0.5 } = track.echo ?? {};
  processLoop(groups.delay, createPingPong({ samples: Math.round(stepFrames * steps), feedback, tone }));
  mixInto(groups.reverb, groups.delay, 0.3);
  processLoop(groups.reverb, createReverb(track.space ?? {}));
  return { delayGain: gain, reverbGain: track.space?.gain ?? 1 };
};

const master = (track, groups, returns, frames) => {
  const { drums = 1, bass = 1, music = 1 } = track.mix ?? {};
  const bus = createBus(frames);
  mixInto(bus, groups.drums, drums);
  mixInto(bus, groups.bass, bass);
  mixInto(bus, groups.music, music);
  mixInto(bus, groups.delay, returns.delayGain);
  mixInto(bus, groups.reverb, returns.reverbGain);
  processLoop(bus, createRumbleFilter());
  // 圧縮の効き方を曲ごとにそろえるため、いったん同じラウドネスに合わせてから通す
  const level = createBus(frames);
  mixInto(level, bus, dbToGain(GLUE_LUFS - integratedLoudness(bus)));
  processLoop(level, createCompressor(track.glue ?? {}));
  return level;
};

/** 目標のラウドネスに寄せてから先読みリミッターで天井を守る。リミッターで下がった分を見て最大 4 回やり直す */
const finish = (bus, frames) => {
  let gain = dbToGain(TARGET_LUFS - integratedLoudness(bus));
  let result = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    result = createBus(frames);
    mixInto(result, bus, gain);
    processLoop(result, createLimiter({ ceilingDb: CEILING_DB }));
    const lufs = integratedLoudness(result);
    if (Math.abs(lufs - TARGET_LUFS) < 0.15) break;
    gain *= dbToGain(TARGET_LUFS - lufs);
  }
  return result;
};

export const mixdown = (track) => {
  const frames = loopFrames(track);
  const groups = renderGroups(track, frames);
  const curve = duckCurve(track, frames);
  applyCurve(groups.bass, curve);
  applyCurve(groups.music, curve);
  const returns = renderReturns(track, groups);
  const bus = finish(master(track, groups, returns, frames), frames);
  return { bus, frames, lufs: integratedLoudness(bus), peakDb: samplePeakDb(bus) };
};
