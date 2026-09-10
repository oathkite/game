import { useState } from "react";
import { useLanguage } from "@/i18n/locale";
import cabin from "../../../../assets/runtime/tanks-v1/cabin-standard.png";
import tracks from "../../../../assets/runtime/tanks-v1/tracks-standard.png";
import pilot from "../../../../assets/runtime/tanks-v1/pilot-frog.png";
import cannon from "../../../../assets/runtime/tanks-v1/weapon-cannon.png";
/** Same 12px/cell layers and anchors as the battlefield, without a WebGL context. */
export const TankPortrait = () => {
  const { t } = useLanguage();
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const ready = (source: string) => setLoaded(previous => previous.has(source) ? previous : new Set([...previous, source]));
  const layer = (source: string, frame: number, height = 160) => <svg x="40" y="10" width="240" height="200" viewBox={`${frame * 192} 0 192 160`} overflow="hidden"><image onLoad={() => ready(source)} href={source} width="768" height={height} /></svg>;
  return <div className="tank-portrait" data-loaded={loaded.size === 4} role="img" aria-label={t("カエルのパイロットと黄色いケロポッド")}>
    <svg viewBox="0 0 320 220" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated" }}>
      {layer(tracks, 0)}{layer(cabin, 0)}{layer(pilot, 0, 640)}{layer(cabin, 1)}{layer(cabin, 2)}{layer(cabin, 3)}
      <g transform="translate(160 130) rotate(-10)"><image onLoad={() => ready(cannon)} href={cannon} x="-120" y="-120" width="240" height="200" /></g>
    </svg>
  </div>;
};
