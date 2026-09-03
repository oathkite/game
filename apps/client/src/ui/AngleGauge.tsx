import type { Facing } from "@game/protocol";
import { ELEVATION_MAX, ELEVATION_MIN, fireAngle } from "@game/sim";

// 角度計。設計書 03 の 3.4。正円の中に車体の軸（点線）、発射角の針、撃てる範囲の弧を描く。
// 針と軸はセルで組めないので線で描く。UI の中で任意の角度の線を使うのはこの 2 本だけ。

type Props = {
  readonly size: number;
  readonly tilt: number;
  readonly elevation: number;
  readonly facing: Facing;
};

const DEG = Math.PI / 180;

/** 数学座標（y 上向き、度）から SVG 座標へ */
const point = (cx: number, cy: number, r: number, deg: number): readonly [number, number] => [cx + r * Math.cos(deg * DEG), cy - r * Math.sin(deg * DEG)];

const arc = (cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string => {
  const [x0, y0] = point(cx, cy, r, fromDeg);
  const [x1, y1] = point(cx, cy, r, toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  // 数学座標では角度の増加が反時計回りなので、SVG では sweep 0
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 0 ${x1} ${y1}`;
};

export const AngleGauge = ({ size, tilt, elevation, facing }: Props) => {
  const c = size / 2;
  const r = c - 3;
  const angle = fireAngle(tilt, elevation, facing);
  const [nx, ny] = point(c, c, r - 2, angle);
  const [ax0, ay0] = point(c, c, r, tilt);
  const [ax1, ay1] = point(c, c, r, tilt + 180);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-label="angle">
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--ui-dim)" strokeWidth={2} />
      <path d={arc(c, c, r, tilt + ELEVATION_MIN, tilt + ELEVATION_MAX)} fill="none" stroke="var(--ui)" strokeWidth={3} />
      <path d={arc(c, c, r, 180 + tilt - ELEVATION_MAX, 180 + tilt - ELEVATION_MIN)} fill="none" stroke="var(--ui)" strokeWidth={3} />
      <line x1={ax0} y1={ay0} x2={ax1} y2={ay1} stroke="var(--ui-dim)" strokeWidth={1} strokeDasharray="2 2" />
      <line x1={c} y1={c} x2={nx} y2={ny} stroke="var(--ui)" strokeWidth={2} />
    </svg>
  );
};

export const fireAngleLabel = (tilt: number, elevation: number, facing: Facing): number => {
  const a = fireAngle(tilt, elevation, facing);
  // 表示は向いている側を基準にした角度。左向きなら 180 から引いて水平からの角度にする
  return facing === 1 ? a : 180 - a;
};
