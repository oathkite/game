import { WIND_MAX } from "@game/sim";
import type { Rect } from "@/game/pixelGrid";
import { useLanguage } from "@/i18n/locale";
import { WIND_METER_HALF, WIND_METER_HEIGHT, mirrorRects, windArrowRects, windStrength, windTicks } from "./windMeterPixels";

type Side = -1 | 1;

// ほかのドット絵（WeaponIcon など）と同じく SVG の rect で描く。
// オンラインの画面は毎フレーム描き直すので、片側ごとの目盛りと強さ 0 から WIND_MAX までの矢印を先に作っておく
const rectsOf = (rects: readonly Rect[]) => rects.map(r => <rect key={`${r.left}/${r.top}`} x={r.left} y={r.top} width={r.width} height={r.height} />);
const scaleOf = (side: Side) => {
  const orient = <T extends Rect>(rects: readonly T[]): readonly T[] => side < 0 ? mirrorRects(rects) : rects;
  const ticks = windTicks();
  return {
    minor: rectsOf(orient(ticks.filter(t => !t.major))),
    major: rectsOf(orient(ticks.filter(t => t.major))),
    arrows: Array.from({ length: WIND_MAX + 1 }, (_, strength) => rectsOf(orient(windArrowRects(strength)))),
  };
};
const LEFT = scaleOf(-1), RIGHT = scaleOf(1);

const WindHalf = ({ side, strength }: { readonly side: Side; readonly strength: number }) => {
  const scale = side < 0 ? LEFT : RIGHT;
  return <svg className="battle-wind-half" viewBox={`0 0 ${WIND_METER_HALF} ${WIND_METER_HEIGHT}`} aria-hidden="true" shapeRendering="crispEdges" data-side={side}>
    <g className="battle-wind-tick">{scale.minor}</g>
    <g className="battle-wind-tick is-major">{scale.major}</g>
    {strength > 0 && <g className="battle-wind-arrow">{scale.arrows[strength]}</g>}
  </svg>;
};

const windLabel = (wind: number | null, t: (text: string) => string): string => {
  if (wind === null) return t("風は未定");
  if (wind === 0) return t("無風");
  return `${wind < 0 ? t("左向きの風") : t("右向きの風")} ${Math.abs(wind)}`;
};

/** 風の向きと強さ（設計書 08 の 8.5）。値はシミュレーションの単位で、m/s ではない。null は風がまだ決まっていないことを表し、「—」を出す。
    支援技術には読み上げ用の文だけを見せ、風が変わったら polite で読み上げる。 */
export const WindGauge = ({ wind }: { readonly wind: number | null }) => {
  const { t } = useLanguage();
  const direction = wind === null ? 0 : Math.sign(wind);
  const strength = wind === null ? 0 : windStrength(wind);
  return <div className="battle-wind" aria-live="polite" aria-atomic="true" data-direction={wind === null ? undefined : direction} data-strength={strength}>
    <WindHalf side={-1} strength={direction < 0 ? strength : 0} />
    <b aria-hidden="true">{wind === null ? "—" : Math.abs(wind)}</b>
    <WindHalf side={1} strength={direction > 0 ? strength : 0} />
    <span className="battle-sr">{windLabel(wind, t)}</span>
  </div>;
};
