import type { RoomRegion } from "@game/protocol/v2-rooms";
export const regions = ["asia", "europe", "americas"] as const;
export type RegionTiming = { readonly region: RoomRegion; readonly milliseconds: number | null };
export const fastestRegion = (timings: readonly RegionTiming[]): RoomRegion | null => {
  const available = timings.filter(t => t.milliseconds !== null);
  return available.sort((a, b) => a.milliseconds! - b.milliseconds!)[0]?.region ?? null;
};
export const measureRegions = async (base: string, mode: "1v1" | "2v2", signal: AbortSignal,
  request: typeof fetch = fetch, now = () => performance.now()): Promise<RegionTiming[]> => Promise.all(regions.map(async region => {
  const samples: number[] = [];
  for (let i = 0; i < 3 && !signal.aborted; i++) {
    const controller = new AbortController(), abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 2000);
    try {
      const url = new URL(`/v2/regions/${region}/probe`, base); url.searchParams.set("mode", mode);
      const start = now(), response = await request(url.href, { signal: controller.signal, cache: "no-store" });
      const data = response.ok ? await response.json() : null;
      if (data?.region === region && data.mode === mode) samples.push(Math.max(0, Math.round(now() - start)));
    } catch { /* Unavailable samples are never interpreted as zero latency. */ }
    finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
  }
  samples.sort((a, b) => a - b);
  return { region, milliseconds: !signal.aborted && samples.length >= 2 ? samples[Math.floor(samples.length / 2)]! : null };
}));
