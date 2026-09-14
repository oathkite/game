import loops from "../assets/music/loops.json";
import { MUSIC_URLS, type MusicName } from './musicTracks';
export type { MusicName } from './musicTracks';

/** Decode only requested scores. Two cached stereo tracks bound mobile memory use. */
export const createChipMusic = (ctx: AudioContext, output: AudioNode) => {
  const buffers = new Map<MusicName, AudioBuffer>();
  let current: MusicName | null = null;
  let request = 0;
  let loading: AbortController | null = null;
  let playing: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  const fadeOut = () => {
    if (!playing) return;
    playing.gain.gain.cancelScheduledValues(ctx.currentTime);
    playing.gain.gain.setValueAtTime(playing.gain.gain.value, ctx.currentTime);
    playing.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + .45);
    playing.source.stop(ctx.currentTime + .46);
    playing = null;
  };
  return {
    async setMusic(name: MusicName | null) {
      if (name === current) return;
      current = name;
      const token = ++request;
      loading?.abort(); loading = null;
      if (!name) { fadeOut(); return; }
      try {
        let buffer = buffers.get(name);
        if (!buffer) {
          const controller = new AbortController(); loading = controller;
          const response = await fetch(MUSIC_URLS[name], { signal: controller.signal });
          if (!response.ok) throw new Error(`Music response ${response.status}`);
          buffer = await ctx.decodeAudioData(await response.arrayBuffer());
          if (token !== request) return;
          buffers.set(name, buffer);
          if (buffers.size > 2) buffers.delete(buffers.keys().next().value!);
          loading = null;
        }
        if (token !== request) return;
        fadeOut();
        const source = ctx.createBufferSource(), gain = ctx.createGain();
        source.buffer = buffer; source.loop = true;
        source.loopStart = loops[name].start; source.loopEnd = loops[name].end;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(1, ctx.currentTime + .45);
        source.connect(gain).connect(output);
        source.onended = () => { source.disconnect(); gain.disconnect(); };
        source.start(0, loops[name].start); playing = { source, gain };
      } catch (error) {
        if (token !== request) return;
        current = null; loading = null; fadeOut();
        console.warn('Music could not be loaded', error);
      }
    },
  };
};
