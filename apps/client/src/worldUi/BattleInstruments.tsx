import { useLanguage } from "@/i18n/locale";
import { useId } from "react";
import { fireAngle } from "@game/sim";

export const MovementReserve = ({ steps }: { readonly steps: number }) => {
  const { t } = useLanguage();
  return <div className="battle-movement" role="meter" aria-label={t("残り移動")} aria-valuemin={0} aria-valuemax={30} aria-valuenow={steps}>
    <svg className="battle-movement-icon" viewBox="0 0 24 16" aria-hidden="true"><path d="M5 5h14l3 3v5H2V8Z" fill="#819eae" stroke="#b9ced8" /><path d="M8 2h8v3H8Z" fill="#819eae" />{[6, 12, 18].map(x => <circle key={x} cx={x} cy="10" r="2" fill="#152c3d" />)}</svg>
    <output aria-hidden="true">{steps}</output>
    <svg className="battle-movement-cells" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true">
      {[0, 1, 2].map(i => <g key={i} transform={`translate(${i * 35} 0)`}><rect y="1" width="30" height="14" rx="2" fill="#081a29" stroke="#365468" /><rect data-reserve-fill={Math.max(0, Math.min(10, steps - i * 10)) * 3} y="2" width={Math.max(0, Math.min(10, steps - i * 10)) * 3} height="12" rx="1" fill="#26bbe6" /><path d="M2 3H28" stroke="#c1f7ff" opacity=".35" /></g>)}
    </svg>
  </div>;
};

export const PowerRuler = ({ value }: { readonly value: number }) => {
  const { t } = useLanguage();
  const gradient = useId(), power = Math.max(0, Math.min(100, value));
  return <div className="battle-power" role="meter" aria-label={t("パワー")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(power)} data-testid="prototype-power">
    <strong className="battle-power-value" style={{ left: `clamp(10px, ${power}%, calc(100% - 10px))` }}>{Math.round(power)}</strong>
    <svg viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="0" x2="1000"><stop stopColor="#51e899" /><stop offset=".6" stopColor="#e8e860" /><stop offset="1" stopColor="#ff9b50" /></linearGradient></defs>
      <rect y="5" width="1000" height="22" fill="#3b5265" />
      <rect y="5" width={power * 10} height="22" fill={`url(#${gradient})`} />
      {Array.from({ length: 100 }, (_, i) => <rect key={i} x={i * 10} y="5" width="2" height="22" fill="#102333" />)}
      <path d="M0 5H1000M0 27H1000" stroke="#8397a8" />
      {Array.from({ length: 101 }, (_, i) => <line key={i} data-power-tick={i} data-major={i % 10 === 0} x1={i * 10} x2={i * 10} y1="28" y2={i % 10 === 0 ? 39 : 33} stroke={i % 10 === 0 ? "#fff6df" : "#a6bbcb"} strokeWidth={i % 10 === 0 ? 2 : 1} />)}
      <path data-cursor={power} d={`M${power * 10 - 6} -3h12l-6 7ZM${power * 10} 5v35`} fill="#fff5a7" stroke="#fff5a7" strokeWidth="2" />
    </svg>
    <div className="battle-power-labels">{Array.from({ length: 11 }, (_, i) => <span key={i} style={{ left: `${i * 10}%` }}>{i * 10}</span>)}</div>
  </div>;
};

export const AngleDial = ({ tilt, elevation, facing }: { readonly tilt: number; readonly elevation: number; readonly facing: -1 | 1 }) => {
  const { t } = useLanguage();
  const finish = useId();
  const world = fireAngle(tilt, elevation, facing), ground = facing === 1 ? tilt : 180 + tilt;
  const point = (angle: number, radius: number) => ({ x: 60 + Math.cos(angle * Math.PI / 180) * radius, y: 60 - Math.sin(angle * Math.PI / 180) * radius });
  const start = point(ground, 32), end = point(world, 32);
  return <svg className="battle-angle" viewBox="0 0 120 120" role="img" aria-label={t("地面 {tilt}度、射角 {elevation}度、水平から {world}度", { tilt, elevation, world })} data-ground-angle={tilt} data-world-angle={world} data-elevation={elevation}>
    <defs>
      <linearGradient id={`${finish}-brass`} x1="0" y1="0" x2=".7" y2="1">
        <stop stopColor="#fff1b5" /><stop offset=".24" stopColor="#d6bd72" /><stop offset=".55" stopColor="#8a6937" /><stop offset=".78" stopColor="#e4c77e" /><stop offset="1" stopColor="#a08048" />
      </linearGradient>
      <radialGradient id={`${finish}-face`} cx=".4" cy=".3" r=".8">
        <stop stopColor="#20394b" /><stop offset=".65" stopColor="#0d202e" /><stop offset="1" stopColor="#06131d" />
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="58" fill="#0a1720" stroke="#59482b" />
    <circle cx="60" cy="60" r="56.5" fill={`url(#${finish}-brass)`} stroke="#f1d995" />
    <circle cx="60" cy="60" r="51" fill={`url(#${finish}-face)`} stroke="#624c2c" strokeWidth="2" />
    <path d="M7 60A53 53 0 0 1 60 7" fill="none" stroke="#fff4c7" strokeOpacity=".75" />
    {Array.from({ length: 36 }, (_, i) => <line key={i} x1="60" x2="60" y1="12" y2={i % 3 === 0 ? 20 : 16} stroke="#9baeb8" transform={`rotate(${i * 10} 60 60)`} />)}
    <path d="M13 60H107" stroke="#698ba5" strokeDasharray="4 4" />
    <path d="M15 60H105" stroke="#f4bd56" strokeWidth="2" transform={`rotate(${-tilt} 60 60)`} />
    <path d={`M${start.x} ${start.y}A32 32 0 0 ${facing === 1 ? 0 : 1} ${end.x} ${end.y}`} stroke="#95e889" fill="none" strokeWidth="2" />
    <path d="M54 60L101 58L106 60L101 62Z" fill="#ff806c" transform={`rotate(${-world} 60 60)`} />
    <circle cx="60" cy="60" r="5" fill={`url(#${finish}-brass)`} stroke="#796a43" /><circle cx="60" cy="60" r="2" fill="#29362f" />
    <text x="34" y="89" textAnchor="middle" fill="#f4bd56" fontSize="13">{tilt}°</text><text x="85" y="89" textAnchor="middle" fill="#95e889" fontSize="15" data-testid="camera-angle">{elevation}°</text>
  </svg>;
};
