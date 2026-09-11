import { afterEach, expect, it, vi } from "vitest";
import { createSampleAudio } from "../src/app/sampleAudio";

const sourceNode = () => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), loop: false, onended: null });
const setup = () => {
  const sources: Array<ReturnType<typeof sourceNode>> = [];
  const ctx = {
    currentTime: 1,
    decodeAudioData: vi.fn(async () => ({ duration: 8 })),
    createBufferSource: () => {
      const source = sourceNode();
      sources.push(source); return source;
    },
    createGain: () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: {
      value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(),
    } }),
  };
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })));
  return { audio: createSampleAudio(ctx as unknown as AudioContext, {} as AudioNode), sources, ctx };
};
afterEach(() => vi.unstubAllGlobals());
it("uses decoded effects without fetching or delaying the shot", async () => {
  const { audio, sources } = setup();
  expect(audio.playEffect("fire")).toBe(false);
  await audio.preload();
  expect(audio.playEffect("fire")).toBe(true);
  expect(sources[0]!.start).toHaveBeenCalledOnce();
  expect(audio.playEffect("finish")).toBe(false);
});
it("keeps synthesized effects available when downloads fail", async () => {
  const { audio } = setup();
  vi.mocked(fetch).mockRejectedValue(new Error("offline"));
  await audio.preload();
  expect(audio.playEffect("hit")).toBe(false);
});
it("loops music and does not restart it for the same scene", async () => {
  const { audio, sources } = setup();
  await audio.setMusic("lobby");
  await audio.setMusic("lobby");
  expect(sources).toHaveLength(1);
  expect(sources[0]!.loop).toBe(true);
  await audio.setMusic(null);
  expect(sources[0]!.stop).toHaveBeenCalled();
});
it("does not start an obsolete scene after a slow download", async () => {
  const { audio, sources } = setup();
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const old = audio.setMusic("title");
  await audio.setMusic("battle");
  resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) } as Response);
  await old;
  expect(sources).toHaveLength(1);
});
it("cancels a pending music start on exit", async () => {
  const { audio, sources } = setup();
  const pending = audio.setMusic("title");
  await audio.setMusic(null);
  await pending;
  expect(sources).toHaveLength(0);
});

it("retries music after a transient failure", async () => {
  const { audio, sources } = setup();
  vi.mocked(fetch).mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline"));
  await audio.setMusic("title");
  expect(sources).toHaveLength(0);
  await audio.setMusic("title");
  expect(sources).toHaveLength(1);
});

it("falls back to the compatible format when the compact codec cannot decode", async () => {
  const { audio, sources, ctx } = setup();
  ctx.decodeAudioData.mockRejectedValueOnce(new Error("Unsupported codec"));
  await audio.setMusic("battle");
  expect(sources).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(String(vi.mocked(fetch).mock.calls[0]![0])).toContain("battle.opus");
  expect(String(vi.mocked(fetch).mock.calls[1]![0])).toContain("battle.mp3");
});
