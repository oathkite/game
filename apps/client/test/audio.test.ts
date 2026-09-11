import { afterEach, describe, expect, it, vi } from "vitest";

const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
const node = () => ({ connect: vi.fn().mockReturnThis() });

const setup = async () => {
  vi.resetModules();
  const gains: Array<ReturnType<typeof node> & { gain: ReturnType<typeof param> }> = [];
  const compressor = { ...node(), threshold: param(), ratio: param(), attack: param(), release: param() };
  const ctx = {
    state: "running", currentTime: 12, destination: {},
    createDynamicsCompressor: () => compressor,
    createGain: () => { const gain = { ...node(), gain: param() }; gains.push(gain); return gain; },
    createOscillator: () => ({ ...node(), frequency: param(), start: vi.fn(), stop: vi.fn() }),
  };
  vi.stubGlobal("AudioContext", function () { return ctx; });
  return { audio: await import("../src/app/audio"), gains, compressor, ctx };
};

afterEach(() => vi.unstubAllGlobals());

describe("audio output settings", () => {
  it("routes all sounds through the saved output volume", async () => {
    const { audio, gains, compressor, ctx } = await setup();
    audio.setAudioSettings(0.3, false);
    audio.unlockAudio();
    expect(gains[0]!.gain.value).toBe(0.3);
    expect(compressor.connect).toHaveBeenCalledWith(gains[0]);
    expect(gains[0]!.connect).toHaveBeenCalledWith(ctx.destination);
  });

  it("mutes and restores the output while a sound is already playing", async () => {
    const { audio, gains } = await setup();
    audio.unlockAudio();
    audio.playSound("explosion");
    audio.setAudioSettings(0.7, true);
    expect(gains[0]!.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 12);
    audio.setAudioSettings(0.2, false);
    expect(gains[0]!.gain.setValueAtTime).toHaveBeenLastCalledWith(0.2, 12);
    // Individual envelopes must not apply the output volume a second time.
    expect(gains[1]!.gain.setValueAtTime).toHaveBeenCalledWith(0.6, 12);
  });

  it("does not start a sound when muted", async () => {
    const { audio, gains } = await setup();
    audio.setAudioSettings(0.5, true);
    audio.unlockAudio();
    audio.playSound("fire");
    expect(gains).toHaveLength(1);
    expect(gains[0]!.gain.value).toBe(0);
  });
});
