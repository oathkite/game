import { useMemo } from "react";
import { useLanguage } from "@/i18n/locale";
import { DEFAULT_LOADOUT, frameSkinOf, turretSkinOf, type Loadout, type TankColors } from "@game/protocol";
import { cssHex, TEAM_RAMPS } from "@/game/palette";
import { colorRuns } from "@/game/pixelGrid";
import { composeTank } from "@/game/tankSprite";

// ロビー、部屋、リザルトの機体。対戦と同じスプライトを SVG の rect で描く（設計書 40.5、43）。
// スキンによらず同じ大きさに見せるため、viewBox は全スキンと全武器が収まる固定の枠にする。
// 縦横比は肖像の枠（320 / 220）より縦長にして、枠の高さで拡大を決め、接地点の高さをどの枠でも 34 / 35 に揃える（dock.css）。
export const PORTRAIT_VIEW = { left: -25, top: -34, width: 50, height: 35 } as const;

type Props = { readonly colors?: TankColors | undefined; readonly loadout?: Loadout | undefined; readonly label?: string };

export const TankPortrait = ({ colors, loadout = DEFAULT_LOADOUT, label }: Props) => {
  const { t } = useLanguage();
  const primary = colors?.primary ?? "green", secondary = colors?.secondary ?? "green";
  // 部屋とリザルトでは相手の色を描く。後から足されて知らないスキンは既定のスキンで描く
  const turretSkin = turretSkinOf(colors?.turret), frame = frameSkinOf(colors?.frame);
  const [weapon, sub] = loadout;
  const runs = useMemo(() => colorRuns(composeTank({
    hull: TEAM_RAMPS[primary], turret: TEAM_RAMPS[secondary], turretSkin, frame, weapon, sub,
    facing: 1, tilt: 0, elevation: 20, recoil: 0, sink: 0, treadPhase: 0, white: false, wrecked: false, rim: "none", flash: null, sparks: [],
  })), [primary, secondary, turretSkin, frame, weapon, sub]);
  const view = PORTRAIT_VIEW;
  return <div className="tank-portrait" data-loaded="true" role="img" aria-label={label ?? t("機体")}>
    <svg viewBox={`${view.left} ${view.top} ${view.width} ${view.height}`} aria-hidden="true" shapeRendering="crispEdges" preserveAspectRatio="xMidYMax meet" style={{ width: "100%", height: "100%", display: "block" }}>
      {runs.map(r => <rect key={`${r.x}/${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={cssHex(r.color)} />)}
    </svg>
  </div>;
};
