import { describe, expect, it } from "vitest";
import { renderChipTrack, type MusicName } from "../src/app/chipMusic";
describe("chip music", () => {
  it.each<MusicName>(["title", "lobby", "battle", "result"])("renders a bounded, non-silent loop with silent joins: %s", name => {
    const samples = renderChipTrack(name, 8000);
    let peak = 0, energy = 0;
    for (const value of samples) { expect(Number.isFinite(value)).toBe(true); peak = Math.max(peak, Math.abs(value)); energy += value * value; }
    expect(peak).toBeGreaterThan(.03); expect(peak).toBeLessThan(.3);
    expect(energy / samples.length).toBeGreaterThan(.0001);
    expect(samples[0]).toBe(0); expect(samples[samples.length - 1]).toBe(0);
  });
  it("uses a different score for each scene", () => {
    const tracks = ["title", "lobby", "battle", "result"].map(name => renderChipTrack(name as MusicName, 8000));
    for (let i = 1; i < tracks.length; i++) expect(tracks[i]).not.toEqual(tracks[i - 1]);
  });
});

it("keeps the current loop playing and stops the previous source on scene changes", async () => {
  const { createChipMusic } = await import("../src/app/chipMusic");
  const { vi } = await import("vitest");
  const sources: Array<{ loop: boolean; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }> = [];
  const parameter = () => ({ value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const ctx = {
    sampleRate: 8000, currentTime: 2,
    createBuffer: () => ({ copyToChannel: vi.fn() }),
    createGain: () => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() }),
    createBufferSource: () => {
      const source = { loop: false, start: vi.fn(), stop: vi.fn(), connect: vi.fn().mockImplementation(node => node), disconnect: vi.fn() };
      sources.push(source); return source;
    },
  };
  const music = createChipMusic(ctx as unknown as AudioContext, {} as AudioNode);
  music.setMusic("battle"); music.setMusic("battle");
  expect(sources).toHaveLength(1); expect(sources[0]!.loop).toBe(true);
  expect(sources[0]!.start).toHaveBeenCalledTimes(1);
  music.setMusic("result");
  expect(sources[0]!.stop).toHaveBeenCalledWith(2.09);
  expect(sources[1]!.loop).toBe(true);
  music.setMusic(null);
  expect(sources[1]!.stop).toHaveBeenCalledWith(2.09);
});
