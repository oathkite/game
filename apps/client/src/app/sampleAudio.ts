import fireCompact from "../assets/audio/fire.opus";
import explosionCompact from "../assets/audio/explosion.opus";
import hitCompact from "../assets/audio/hit.opus";
import tickCompact from "../assets/audio/tick.opus";
import hitConfirmCompact from "../assets/audio/hit-confirm.opus";
import matchFinishCompact from "../assets/audio/match-finish.opus";
import titleCompact from "../assets/audio/title.opus";
import lobbyCompact from "../assets/audio/lobby.opus";
import battleCompact from "../assets/audio/battle.opus";
import resultCompact from "../assets/audio/result.opus";
import fire from "../assets/audio/fire.wav";
import explosion from "../assets/audio/explosion.wav";
import hit from "../assets/audio/hit.wav";
import tick from "../assets/audio/tick.wav";
import hitConfirm from "../assets/audio/hit-confirm.wav";
import matchFinish from "../assets/audio/match-finish.wav";
import title from "../assets/audio/title.mp3";
import lobby from "../assets/audio/lobby.mp3";
import battle from "../assets/audio/battle.mp3";
import result from "../assets/audio/result.mp3";

const effects = {
  fire: [fireCompact, fire],
  explosion: [explosionCompact, explosion],
  hit: [hitCompact, hit],
  tick: [tickCompact, tick],
  hitConfirm: [hitConfirmCompact, hitConfirm],
  matchFinish: [matchFinishCompact, matchFinish],
} as const;
const music = {
  title: [titleCompact, title],
  lobby: [lobbyCompact, lobby],
  battle: [battleCompact, battle],
  result: [resultCompact, result],
} as const;
export type MusicName = keyof typeof music;

// Lossy decoding can reintroduce a step across an otherwise crossfaded loop.
const softenLoopEndpoints = (buffer: AudioBuffer): void => {
  const frames = Math.min(Math.round(buffer.sampleRate * 0.002), Math.floor(buffer.length / 2));
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < frames; i++) {
      const gain = frames > 1 ? i / (frames - 1) : 0;
      samples[i] = samples[i]! * gain;
      samples[samples.length - 1 - i] = samples[samples.length - 1 - i]! * gain;
    }
  }
};

/** Effects are small and preloaded; only the current music buffer is retained. */
export const createSampleAudio = (ctx: AudioContext, output: AudioNode) => {
  const buffers = new Map<string, AudioBuffer>();
  let desired: MusicName | null = null;
  let generation = 0;
  let playing: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  const decode = async (url: string): Promise<AudioBuffer> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Audio download failed");
    return ctx.decodeAudioData(await response.arrayBuffer());
  };
  const decodeCompatible = async ([compact, fallback]: readonly [string, string]): Promise<AudioBuffer> => {
    try { return await decode(compact); }
    catch { return decode(fallback); }
  };
  const preload = async (): Promise<void> => {
    await Promise.all(Object.entries(effects).map(async ([name, url]) => {
      try { buffers.set(name, await decodeCompatible(url)); } catch { /* Keep the synthesized fallback. */ }
    }));
  };
  const playEffect = (name: string): boolean => {
    const buffer = buffers.get(name);
    if (!buffer) return false;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(output);
    source.onended = () => source.disconnect();
    source.start();
    return true;
  };
  const stopMusic = (): void => {
    if (!playing) return;
    const { source, gain } = playing;
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    source.stop(ctx.currentTime + 0.31);
    playing = null;
  };
  const setMusic = async (name: MusicName | null): Promise<void> => {
    if (desired === name) return;
    desired = name;
    const request = ++generation;
    stopMusic();
    if (!name) return;
    try {
      const buffer = await decodeCompatible(music[name]);
      if (request !== generation) return;
      softenLoopEndpoints(buffer);
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      source.buffer = buffer; source.loop = true;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.65, ctx.currentTime + 0.5);
      source.connect(gain); gain.connect(output);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
      playing = { source, gain };
    } catch {
      // Permit retry on the next gesture without starting stale scene music.
      if (request === generation) desired = null;
    }
  };
  return { preload, playEffect, setMusic };
};
