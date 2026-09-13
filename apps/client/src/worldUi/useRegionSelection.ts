import { useEffect, useRef, useState } from "react";
import type { RoomRegion } from "@game/protocol/v2-rooms";
import { fastestRegion, measureRegions, type RegionTiming } from "./regionLatency";
export const useRegionSelection = (base: string, mode: "1v1" | "2v2") => {
  const [region, setRegion] = useState<RoomRegion | "">(base ? "" : "asia");
  const [timings, setTimings] = useState<RegionTiming[]>([]), [measuring, setMeasuring] = useState(!!base);
  const manual = useRef(false);
  useEffect(() => {
    if (!base) return;
    const controller = new AbortController();
    setMeasuring(true); setTimings([]);
    if (!manual.current) setRegion("");
    void measureRegions(base, mode, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setTimings(result); setMeasuring(false);
      if (!manual.current) setRegion(fastestRegion(result) ?? "");
    });
    return () => controller.abort();
  }, [base, mode]);
  return { region, timings, measuring, selectRegion: (value: RoomRegion) => { manual.current = true; setRegion(value); } };
};
