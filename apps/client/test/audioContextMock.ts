import { vi } from "vitest";

// Web Audio の最小限の偽物。どの音源がいつ始まり、どの値へ向かって動いたかだけを記録する。

export const createParam = (value = 0) => ({
  value,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
});

const createNode = () => ({ connect: vi.fn((next: unknown) => next), disconnect: vi.fn() });

export const createAudioContextMock = () => {
  const gains: Array<ReturnType<typeof createNode> & { gain: ReturnType<typeof createParam> }> = [];
  const sources: Array<ReturnType<typeof createNode> & { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: (() => void) | null; kind: string }> = [];
  const shapers: unknown[] = [];
  const compressor = { ...createNode(), threshold: createParam(), knee: createParam(), ratio: createParam(), attack: createParam(), release: createParam() };
  const source = (kind: string, extra: object) => {
    const node = { ...createNode(), ...extra, kind, start: vi.fn(), stop: vi.fn(), onended: null };
    sources.push(node);
    return node;
  };
  const ctx = {
    state: "running", currentTime: 12, sampleRate: 8000, destination: {},
    createDynamicsCompressor: () => compressor,
    createGain: () => { const gain = { ...createNode(), gain: createParam(1) }; gains.push(gain); return gain; },
    createOscillator: () => source("tone", { type: "sine", frequency: createParam() }),
    createBufferSource: () => source("noise", { buffer: null, loop: false }),
    createBiquadFilter: () => ({ ...createNode(), type: "lowpass", frequency: createParam(), Q: createParam() }),
    createWaveShaper: () => { const shaper = { ...createNode(), curve: null, oversample: "none" }; shapers.push(shaper); return shaper; },
    createConvolver: () => ({ ...createNode(), buffer: null }),
    createBuffer: (channels: number, length: number, rate: number) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { numberOfChannels: channels, length, duration: length / rate, getChannelData: (channel: number) => data[channel]! };
    },
  };
  return { ctx, gains, sources, shapers, compressor };
};
