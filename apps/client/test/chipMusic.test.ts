import { afterEach, expect, it, vi } from 'vitest';
import { createChipMusic } from '../src/app/chipMusic';
import { stageMusic } from '../src/app/musicTracks';
afterEach(() => vi.unstubAllGlobals());
const setup = () => {
  const sources: any[] = [];
  const parameter = () => ({ value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const ctx = { currentTime: 2, decodeAudioData: vi.fn(async () => ({})), createGain: () => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() }),
    createBufferSource: () => { const source = { loop: false, start: vi.fn(), stop: vi.fn(), connect: vi.fn(node => node), disconnect: vi.fn() }; sources.push(source); return source; } };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })));
  return { sources, music: createChipMusic(ctx as unknown as AudioContext, {} as AudioNode) };
};
it('preserves the current loop and crossfades scene changes', async () => {
  const { sources, music } = setup();
  await music.setMusic('ridgeline'); await music.setMusic('ridgeline');
  expect(sources).toHaveLength(1); expect(sources[0].loop).toBe(true);
  await music.setMusic('result');
  expect(sources[0].stop).toHaveBeenCalledWith(2.46);
  await music.setMusic(null); expect(sources[1].stop).toHaveBeenCalledWith(2.46);
});
it('does not start a stale download after a newer scene starts', async () => {
  const { sources, music } = setup();
  let resolve!: (value: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(r => { resolve = r; }) as Promise<Response>);
  const old = music.setMusic('lobby'); await music.setMusic('room');
  resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) } as Response); await old;
  expect(sources).toHaveLength(1);
});
it('maps every current stage and personal result to its own track', () => {
  expect(['moss-valley','rock-arch','reed-hills','sky-islands'].map(stageMusic)).toEqual(['ridgeline','stone-bridge','terraces','sky-islands']);
});
