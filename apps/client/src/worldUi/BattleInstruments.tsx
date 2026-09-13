import { useLanguage } from "@/i18n/locale";
import { fireAngle } from "@game/sim";

export const MovementReserve = ({ steps }: { readonly steps: number }) => {
  const { t } = useLanguage();
  return <div className="battle-movement" role="meter" aria-label={t("残り移動")} aria-valuemin={0} aria-valuemax={30} aria-valuenow={steps}>
    <svg className="battle-movement-icon" viewBox="0 0 24 16" aria-hidden="true"><path d="M5 5h14l3 3v5H2V8Z" fill="#33ff66" stroke="#33ff66" /><path d="M8 2h8v3H8Z" fill="#33ff66" />{[6, 12, 18].map(x => <circle key={x} cx={x} cy="10" r="2" fill="#000" />)}</svg>
    <output aria-hidden="true">{steps}</output>
    <svg className="battle-movement-cells" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true">
      {[0, 1, 2].map(i => <g key={i} transform={`translate(${i * 35} 0)`}><rect y="1" width="30" height="14" rx="2" fill="#000" stroke="#33ff66" /><rect data-reserve-fill={Math.max(0, Math.min(10, steps - i * 10)) * 3} y="2" width={Math.max(0, Math.min(10, steps - i * 10)) * 3} height="12" rx="1" fill="#33ff66" /><path d="M2 3H28" stroke="#33ff66" opacity=".35" /></g>)}
    </svg>
  </div>;
};

export const PowerRuler = ({ value }: { readonly value: number }) => {
  const { t } = useLanguage();
  const power = Math.max(0, Math.min(100, value));
  return <div className="battle-power" role="meter" aria-label={t("パワー")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(power)} data-testid="prototype-power">
    <strong className="battle-power-value" style={{ left: `clamp(10px, ${power}%, calc(100% - 10px))` }}>{Math.round(power)}</strong>
    <svg viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
        <rect y="5" width="1000" height="22" fill="#000" />
      <rect y="5" width={power * 10} height="22" fill="#33ff66" />
      {Array.from({ length: 100 }, (_, i) => <rect key={i} x={i * 10} y="5" width="2" height="22" fill="#000" />)}
      <path d="M0 5H1000M0 27H1000" stroke="#33ff66" />
      {Array.from({ length: 101 }, (_, i) => <line key={i} data-power-tick={i} data-major={i % 10 === 0} x1={i * 10} x2={i * 10} y1="28" y2={i % 10 === 0 ? 39 : 33} stroke={i % 10 === 0 ? "#33ff66" : "#33ff66"} strokeWidth={i % 10 === 0 ? 2 : 1} />)}
      <path data-cursor={power} d={`M${power * 10 - 6} -3h12l-6 7ZM${power * 10} 5v35`} fill="#33ff66" stroke="#33ff66" strokeWidth="2" />
    </svg>
    <div className="battle-power-labels">{Array.from({ length: 11 }, (_, i) => <span key={i} style={{ left: `${i * 10}%` }}>{i * 10}</span>)}</div>
  </div>;
};

export const AngleDial = ({ tilt, elevation, facing }: { readonly tilt: number; readonly elevation: number; readonly facing: -1 | 1 }) => {
  const { t } = useLanguage();
  const world = fireAngle(tilt, elevation, facing), ground = facing === 1 ? tilt : 180 + tilt;
  const point = (angle: number, radius: number) => ({ x: 60 + Math.cos(angle * Math.PI / 180) * radius, y: 60 - Math.sin(angle * Math.PI / 180) * radius });
  const start = point(ground, 32), end = point(world, 32);
  return <svg className="battle-angle" viewBox="0 0 120 120" role="img" aria-label={t("地面 {tilt}度、射角 {elevation}度、水平から {world}度", { tilt, elevation, world })} data-ground-angle={tilt} data-world-angle={world} data-elevation={elevation}>
    <circle cx="60" cy="60" r="58" fill="#000" stroke="#33ff66" />
    <circle cx="60" cy="60" r="56.5" fill="#33ff66" stroke="#33ff66" />
    <circle cx="60" cy="60" r="51" fill="#000" stroke="#33ff66" strokeWidth="2" />
    <path d="M7 60A53 53 0 0 1 60 7" fill="none" stroke="#33ff66" strokeOpacity=".75" />
    {Array.from({ length: 36 }, (_, i) => <line key={i} x1="60" x2="60" y1="12" y2={i % 3 === 0 ? 20 : 16} stroke="#33ff66" transform={`rotate(${i * 10} 60 60)`} />)}
    <path d="M13 60H107" stroke="#698ba5" strokeDasharray="4 4" />
    <path d="M15 60H105" stroke="#f4bd56" strokeWidth="2" transform={`rotate(${-tilt} 60 60)`} />
    <path d={`M${start.x} ${start.y}A32 32 0 0 ${facing === 1 ? 0 : 1} ${end.x} ${end.y}`} stroke="#95e889" fill="none" strokeWidth="2" />
    <path d="M54 60L101 58L106 60L101 62Z" fill="#ff806c" transform={`rotate(${-world} 60 60)`} />
    <circle cx="60" cy="60" r="5" fill="#33ff66" stroke="#33ff66" /><circle cx="60" cy="60" r="2" fill="#000" />
    <text x="34" y="89" textAnchor="middle" fill="#f4bd56" fontSize="13">{tilt}°</text><text x="85" y="89" textAnchor="middle" fill="#95e889" fontSize="15" data-testid="camera-angle">{elevation}°</text>
  </svg>;
};
