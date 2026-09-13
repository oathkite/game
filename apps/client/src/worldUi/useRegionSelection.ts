import { regionPreferenceKey, regionFromTimezone, savedRegion, validRegion } from "./regionPreference";
import { useEffect, useRef, useState } from "react";
import type { RoomRegion } from "@game/protocol/v2-rooms";
import { measureRegions, type RegionTiming } from "./regionLatency";
export const useRegionSelection = (base: string, mode: "1v1" | "2v2") => {
  const [region, setRegion] = useState<RoomRegion>(() => savedRegion() ?? regionFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone));
  const [timings, setTimings] = useState<RegionTiming[]>([]), [measuring, setMeasuring] = useState(!!base);
  const manual = useRef(savedRegion() !== null);
  useEffect(() => {
    if (!base || manual.current) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    void fetch(new URL("/v2/region", base), { signal: controller.signal, cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted && !manual.current && validRegion(data?.region)) setRegion(data.region); })
      .catch(() => { /* Keep the timezone fallback when geolocation is unavailable. */ })
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [base]);
  useEffect(() => {
    if (!base) return;
    const controller = new AbortController();
    setMeasuring(true); setTimings([]);
    void measureRegions(base, mode, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setTimings(result); setMeasuring(false);
    });
    return () => controller.abort();
  }, [base, mode]);
  return { region, timings, measuring, selectRegion: (value: RoomRegion) => { manual.current = true; setRegion(value); try { localStorage.setItem(regionPreferenceKey, value); } catch { /* Selection still applies for this session. */ } } };
};
