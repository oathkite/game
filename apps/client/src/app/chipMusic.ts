export type MusicName = "title" | "lobby" | "battle" | "result";
const scores: Record<MusicName, { bpm: number; melody: readonly number[]; bass: readonly number[] }> = {
  title: { bpm: 112, melody: [72,0,79,76,74,0,71,67,69,72,76,79,74,71,67,0], bass: [48,45,53,55] },
  lobby: { bpm: 96, melody: [64,0,67,0,71,69,67,0,62,0,65,69,67,65,62,0], bass: [48,57,53,55] },
  battle: { bpm: 138, melody: [69,76,72,76,69,76,74,71,65,72,69,72,67,74,71,74], bass: [45,45,41,43] },
  result: { bpm: 120, melody: [72,76,79,84,0,79,76,0,74,77,81,86,84,79,76,72], bass: [48,53,55,48] },
};
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** Original four-bar loops. Every note has an envelope; the loop ends at silence. */
export const renderChipTrack = (name: MusicName, sampleRate: number): Float32Array<ArrayBuffer> => {
  const score = scores[name], step = 30 / score.bpm;
  const samples = new Float32Array(Math.ceil(step * 32 * sampleRate));
  const note = (midi: number, start: number, duration: number, level: number, pulse: boolean) => {
    const first = Math.round(start * sampleRate), count = Math.floor(duration * sampleRate), frequency = hz(midi);
    for (let i = 0; i < count && first + i < samples.length; i++) {
      const t = i / sampleRate, envelope = Math.min(1, t / .008, (duration - t) / .03);
      const phase = 2 * Math.PI * frequency * t;
      // Three harmonics give a soft pulse without the harsh edge of a raw square wave.
      const wave = pulse ? (Math.sin(phase) + Math.sin(phase * 3) / 3 + Math.sin(phase * 5) / 5) / 1.54 : Math.sin(phase);
      samples[first + i]! += wave * Math.max(0, envelope) * level;
    }
  };
  for (let i = 0; i < 32; i++) {
    const melody = score.melody[i % 16]!;
    if (melody) note(melody, i * step, step * .8, .075, true);
    if (i % 2 === 0) note(score.bass[Math.floor(i / 8)]!, i * step, step * 1.65, .09, false);
    if (i % 4 === 2) note(42, i * step, .045, .045, true);
  }
  return samples;
};

export const createChipMusic = (ctx: AudioContext, output: AudioNode) => {
  const buffers = new Map<MusicName, AudioBuffer>();
  let current: MusicName | null = null;
  let playing: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  return {
    setMusic(name: MusicName | null) {
      if (name === current) return;
      const previous = playing;
      current = name; playing = null;
      if (previous) {
        previous.gain.gain.cancelScheduledValues(ctx.currentTime);
        previous.gain.gain.setValueAtTime(previous.gain.gain.value, ctx.currentTime);
        previous.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + .08);
        previous.source.stop(ctx.currentTime + .09);
      }
      if (!name) return;
      let buffer = buffers.get(name);
      if (!buffer) {
        const samples = renderChipTrack(name, ctx.sampleRate);
        buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
        buffer.copyToChannel(samples, 0); buffers.set(name, buffer);
      }
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      source.buffer = buffer; source.loop = true;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + .12);
      source.connect(gain).connect(output);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start(); playing = { source, gain };
    },
  };
};
