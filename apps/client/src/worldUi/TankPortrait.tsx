import { useMemo } from "react";
import { useLanguage } from "@/i18n/locale";
import type { TankColors } from "@game/protocol";
import { cssHex, TEAM_RAMPS } from "@/game/palette";
import { colorRuns } from "@/game/pixelGrid";
import { composeTank } from "@/game/tankSprite";

// ロビー、部屋、リザルトの機体。対戦と同じスプライトを SVG の rect で描く（設計書 40.5）。
// 色によらず同じ大きさに見せるため、viewBox は機体と砲身が収まる固定の枠にする。
const VIEW = { left: -20, top: -27, width: 40, height: 28 } as const;

export const TankPortrait = ({ colors, label }: { readonly colors?: TankColors | undefined; readonly label?: string }) => {
  const { t } = useLanguage();
  const primary = colors?.primary ?? "green", secondary = colors?.secondary ?? "green";
  const runs = useMemo(() => colorRuns(composeTank({
    hull: TEAM_RAMPS[primary], turret: TEAM_RAMPS[secondary], facing: 1, tilt: 0, elevation: 20, recoil: 0, sink: 0, treadPhase: 0,
    white: false, wrecked: false, rim: "none", flash: null, sparks: [],
  })), [primary, secondary]);
  return <div className="tank-portrait" data-loaded="true" role="img" aria-label={label ?? t("機体")}>
    <svg viewBox={`${VIEW.left} ${VIEW.top} ${VIEW.width} ${VIEW.height}`} aria-hidden="true" shapeRendering="crispEdges" preserveAspectRatio="xMidYMax meet" style={{ width: "100%", height: "100%", display: "block" }}>
      {runs.map(r => <rect key={`${r.x}/${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={cssHex(r.color)} />)}
    </svg>
  </div>;
};
