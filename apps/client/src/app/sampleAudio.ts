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

const effects = { fire, explosion, hit, tick, hitConfirm, matchFinish };
const music = { title, lobby, battle, result };
export type MusicName = keyof typeof music;

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
  const preload = async (): Promise<void> => {
    await Promise.all(Object.entries(effects).map(async ([name, url]) => {
      try { buffers.set(name, await decode(url)); } catch { /* Keep the synthesized fallback. */ }
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
      const buffer = await decode(music[name]);
      if (request !== generation) return;
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
