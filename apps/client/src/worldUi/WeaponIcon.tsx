import type { WeaponId } from "@game/protocol";
import { useMemo } from "react";
import { cssHex } from "@/game/palette";
import { colorRuns } from "@/game/pixelGrid";
import { iconViewBox, weaponIconGrid } from "./weaponIconGrid";

// 武器のアイコン。40.8 の弾の絵を SVG の rect で描く（設計書 40.10）
export const WeaponIcon = ({ weapon }: { readonly weapon: WeaponId }) => {
  const { runs, view } = useMemo(() => { const grid = weaponIconGrid(weapon); return { runs: colorRuns(grid), view: iconViewBox(grid) }; }, [weapon]);
  // 絵の中心をボタンの中央に合わせる
  return <svg viewBox={`${view.left} ${view.top} ${view.width} ${view.height}`} aria-hidden="true" shapeRendering="crispEdges">
    {runs.map(r => <rect key={`${r.x}/${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={cssHex(r.color)} />)}
  </svg>;
};
