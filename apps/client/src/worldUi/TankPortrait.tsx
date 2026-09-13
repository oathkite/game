import { useLanguage } from "@/i18n/locale";
import { COLOR_HEX, type TankColors } from "@game/protocol";
import { TANK_PIXELS, treadPixels } from "@/game/tankPixels";
export const TankPortrait = ({ colors, label }: { readonly colors?: TankColors | undefined; readonly label?: string }) => {
  const { t } = useLanguage();
  const primary = colors ? COLOR_HEX[colors.primary] : "#33ff66", secondary = colors ? COLOR_HEX[colors.secondary] : "#33ff66";
  return <div className="tank-portrait" data-loaded="true" role="img" aria-label={label ?? t("機体")}>
    <svg viewBox="0 0 80 55" aria-hidden="true" shapeRendering="crispEdges" style={{ width:"100%", height:"100%", display:"block" }}>
      {TANK_PIXELS.map((p,i) => <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.part === "body" ? primary : secondary} />)}
      <rect x="38" y="19" width="32" height="4" fill={secondary} />
      {treadPixels(0).map((p,i) => <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill="#000" />)}
    </svg>
  </div>;
};
