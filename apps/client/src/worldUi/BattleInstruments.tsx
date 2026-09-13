import { dialPoint, pixelLine, type DialPoint } from "./dialPixels";
import { useLanguage } from "@/i18n/locale";
import { fireAngle } from "@game/sim";

export const MovementReserve = ({ steps }: { readonly steps: number }) => {
  const { t } = useLanguage();
  return <div className="battle-movement" role="meter" aria-label={t("残り移動")} aria-valuemin={0} aria-valuemax={30} aria-valuenow={steps}>
    <div className="battle-hp battle-movement-bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(30, steps)) / 30 * 100}%` }} /></div>
  </div>;
};

export const PowerRuler = ({ value }: { readonly value: number }) => {
  const { t } = useLanguage();
  const power = Math.max(0, Math.min(100, value));
  return <div className="battle-power" role="meter" aria-label={t("パワー")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(power)} data-testid="prototype-power">
    <strong className="battle-power-value" style={{ left: `clamp(10px, ${power}%, calc(100% - 10px))` }}>{Math.round(power)}</strong>
    <svg viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true" shapeRendering="crispEdges">
        <rect y="5" width="1000" height="22" fill="#000" />
      <rect y="5" width={power * 10} height="22" fill="#33ff66" />
      {Array.from({ length: 100 }, (_, i) => <rect key={i} x={i * 10} y="5" width="2" height="22" fill="#000" />)}
      <path d="M0 5H1000M0 27H1000" stroke="#33ff66" />
      {Array.from({ length: 101 }, (_, i) => <line key={i} data-power-tick={i} data-major={i % 10 === 0} x1={i * 10} x2={i * 10} y1="28" y2={i % 10 === 0 ? 39 : 33} stroke={i % 10 === 0 ? "#33ff66" : "#33ff66"} strokeWidth={i % 10 === 0 ? 2 : 1} />)}
      <g data-cursor={power} fill="#33ff66"><rect x={Math.round(power*10)-6} y="-3" width="12" height="3" /><rect x={Math.round(power*10)-3} width="6" height="3" /><rect x={Math.round(power*10)-1} y="3" width="2" height="37" /></g>
    </svg>
    <div className="battle-power-labels">{Array.from({ length: 11 }, (_, i) => <span key={i} style={{ left: `${i * 10}%` }}>{i * 10}</span>)}</div>
  </div>;
};

export const AngleDial = ({ tilt, elevation, facing }: { readonly tilt: number; readonly elevation: number; readonly facing: -1 | 1 }) => {
  const { t } = useLanguage();
  const world = fireAngle(tilt, elevation, facing);
  const launchAngle = facing === 1 ? world : 180 - world;
  const dots = (points: readonly DialPoint[], color: string) => points.map((p,i) => <rect key={i} x={p.x} y={p.y} width="2" height="2" fill={color} />);
  return <svg className="battle-angle" shapeRendering="crispEdges" viewBox="0 0 120 120" role="img" aria-label={t("地面 {tilt}度、射角 {elevation}度、水平から {world}度", { tilt, elevation, world: launchAngle })} data-ground-angle={tilt} data-world-angle={world} data-elevation={elevation}>
    {dots(pixelLine(dialPoint(tilt,40),dialPoint(tilt+180,40)),"#69856f")}
    {dots(pixelLine({x:60,y:60},dialPoint(world,42)),"#33ff66")}
    <rect x="58" y="58" width="6" height="6" fill="#33ff66" />
    <rect x="36" y="94" width="48" height="16" fill="#000" />
    <text x="60" y="107" textAnchor="middle" fill="#33ff66" fontSize="15" data-testid="camera-angle">{launchAngle}°</text>
  </svg>;
};
