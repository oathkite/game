import { useLanguage } from "@/i18n/locale";
import { useId } from "react";
import { fireAngle } from "@game/sim";

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
  const world = fireAngle(tilt, elevation, facing), ground = facing === 1 ? tilt : 180 + tilt;
  const point = (angle: number, radius: number) => ({ x: 60 + Math.cos(angle * Math.PI / 180) * radius, y: 60 - Math.sin(angle * Math.PI / 180) * radius });
  const start = point(ground, 32), end = point(world, 32);
  return <svg className="battle-angle" viewBox="0 0 120 120" role="img" aria-label={t("地面 {tilt}度、射角 {elevation}度、水平から {world}度", { tilt, elevation, world })} data-ground-angle={tilt} data-world-angle={world} data-elevation={elevation}>
    <circle cx="60" cy="60" r="57" fill="#c7b478" stroke="#59482b" strokeWidth="2" /><circle cx="60" cy="60" r="51" fill="#102333" stroke="#f4df9f" strokeWidth="2" />
    {Array.from({ length: 36 }, (_, i) => <line key={i} x1="60" x2="60" y1="12" y2={i % 3 === 0 ? 20 : 16} stroke="#9baeb8" transform={`rotate(${i * 10} 60 60)`} />)}
    <path d="M13 60H107" stroke="#698ba5" strokeDasharray="4 4" />
    <path d="M15 60H105" stroke="#f4bd56" strokeWidth="2" transform={`rotate(${-tilt} 60 60)`} />
    <path d={`M${start.x} ${start.y}A32 32 0 0 ${facing === 1 ? 0 : 1} ${end.x} ${end.y}`} stroke="#95e889" fill="none" strokeWidth="2" />
    <path d="M54 60L101 58L106 60L101 62Z" fill="#ff806c" transform={`rotate(${-world} 60 60)`} />
    <circle cx="60" cy="60" r="5" fill="#ead69a" stroke="#796a43" />
    <text x="34" y="89" textAnchor="middle" fill="#f4bd56" fontSize="13">{tilt}°</text><text x="85" y="89" textAnchor="middle" fill="#95e889" fontSize="15" data-testid="camera-angle">{elevation}°</text>
  </svg>;
};
