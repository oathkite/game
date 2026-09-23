import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudioContextMock } from "./audioContextMock";
import { SOUNDS } from "../src/app/soundRecipes";

const setup = async () => {
  vi.resetModules();
  const mock = createAudioContextMock();
  vi.stubGlobal("AudioContext", function () { return mock.ctx; });
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  return { audio: await import("../src/app/audio"), ...mock };
};

afterEach(() => vi.unstubAllGlobals());

// 生成順: 効果音の出力、BGM の出力、BGM のダッキング段
const OUTPUT = 0, MUSIC = 1, DUCK = 2;

describe("audio output settings", () => {
  it("routes all effects through the compressor and the saved output volume", async () => {
    const { audio, gains, compressor, ctx } = await setup();
    audio.setAudioSettings(0.3, false);
    audio.unlockAudio();
    expect(gains[OUTPUT]!.gain.value).toBe(0.3);
    expect(compressor.connect).toHaveBeenCalledWith(gains[OUTPUT]);
    expect(gains[OUTPUT]!.connect).toHaveBeenCalledWith(ctx.destination);
  });

  it("mutes and restores the output while a sound is already playing", async () => {
    const { audio, gains } = await setup();
    audio.unlockAudio();
    audio.playSound("explosion");
    audio.setAudioSettings(0.7, true);
    expect(gains[OUTPUT]!.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 12);
    audio.setAudioSettings(0.2, false);
    expect(gains[OUTPUT]!.gain.setValueAtTime).toHaveBeenLastCalledWith(0.2, 12);
  });

  it("shapes each layer at its designed level instead of applying the volume twice", async () => {
    const { audio, gains } = await setup();
    audio.setAudioSettings(0.2, false);
    audio.unlockAudio();
    audio.playSound("explosion");
    const peaks = gains.flatMap((gain) => gain.gain.linearRampToValueAtTime.mock.calls.map(([value]) => value));
    expect(peaks).toEqual(SOUNDS.explosion.layers.map((layer) => layer.gain));
  });

  it("does not start a sound when muted", async () => {
    const { audio, sources } = await setup();
    audio.setAudioSettings(0.5, true);
    audio.unlockAudio();
    audio.playSound("fire");
    expect(sources).toHaveLength(0);
  });
});

it("layers an explosion from several sources that all start together", async () => {
  const { audio, sources } = await setup();
  audio.unlockAudio();
  audio.playSound("explosion");
  expect(sources.length).toBe(SOUNDS.explosion.layers.length);
  expect(new Set(sources.map((source) => source.kind))).toEqual(new Set(["tone", "noise"]));
  for (const source of sources) expect(source.start.mock.calls[0]![0]).toBeGreaterThanOrEqual(12);
});

it("throttles tread sounds and still honors mute", async () => {
  const { audio, sources, ctx } = await setup();
  audio.unlockAudio();
  const perMove = SOUNDS.move.layers.length;
  audio.playSound("move"); audio.playSound("move");
  expect(sources).toHaveLength(perMove);
  ctx.currentTime += .1;
  audio.playSound("move");
  expect(sources).toHaveLength(perMove * 2);
  audio.setAudioSettings(.5, true);
  ctx.currentTime += .1;
  audio.playSound("move");
  expect(sources).toHaveLength(perMove * 2);
});

it("does not stack the same impact twice in one instant but plays the next stage", async () => {
  const { audio, sources, ctx } = await setup();
  audio.unlockAudio();
  const per = SOUNDS["laser-impact"].layers.length;
  audio.playSound("laser-impact"); audio.playSound("laser-impact");
  expect(sources).toHaveLength(per);
  ctx.currentTime += .05;
  audio.playSound("laser-impact");
  expect(sources).toHaveLength(per * 2);
});

it("dips the music under a heavy impact and lets it recover, but not for a timer tick", async () => {
  const { audio, gains } = await setup();
  audio.unlockAudio();
  audio.playSound("tick");
  expect(gains[DUCK]!.gain.setTargetAtTime).not.toHaveBeenCalled();
  audio.playSound("explosion");
  const duck = SOUNDS.explosion.duck!;
  expect(gains[DUCK]!.gain.setTargetAtTime).toHaveBeenCalledWith(1 - duck, 12, expect.any(Number));
  expect(gains[DUCK]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, expect.any(Number), expect.any(Number));
  expect(gains[MUSIC]!.gain.value).toBe(0.5);
});

it("keeps the deeper dip when a lighter sound follows in the same instant", async () => {
  const { audio, gains, ctx } = await setup();
  audio.unlockAudio();
  audio.playSound("explosion");
  audio.playSound("hit");
  const dips = () => gains[DUCK]!.gain.setTargetAtTime.mock.calls.filter(([value]) => value < 1).map(([value]) => value);
  expect(dips()).toEqual([1 - SOUNDS.explosion.duck!]);
  audio.playSound("finish");
  expect(dips().at(-1)).toBeCloseTo(1 - SOUNDS.finish.duck!);
  ctx.currentTime += 1;
  audio.playSound("hit");
  expect(dips().at(-1)).toBeCloseTo(1 - SOUNDS.hit.duck!);
});

it("keeps music and effects volumes independent across mute", async () => {
  const { audio, gains } = await setup();
  audio.setAudioSettings(.7, false, .2);
  audio.unlockAudio();
  expect(gains[OUTPUT]!.gain.value).toBe(.7);
  expect(gains[MUSIC]!.gain.value).toBe(.2);
  audio.setAudioSettings(.7, true, .2);
  expect(gains[OUTPUT]!.gain.setValueAtTime).toHaveBeenLastCalledWith(0,12);
  expect(gains[MUSIC]!.gain.setValueAtTime).toHaveBeenLastCalledWith(0,12);
  audio.setAudioSettings(.7, false, .2);
  expect(gains[OUTPUT]!.gain.setValueAtTime).toHaveBeenLastCalledWith(.7,12);
  expect(gains[MUSIC]!.gain.setValueAtTime).toHaveBeenLastCalledWith(.2,12);
});
