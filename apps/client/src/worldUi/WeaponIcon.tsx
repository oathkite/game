import type { WeaponId } from "@game/protocol";
import { useMemo } from "react";
import { cssHex } from "@/game/palette";
import { colorRuns } from "@/game/pixelGrid";
import { ICON_VIEW, iconShift, weaponIconGrid } from "./weaponIconGrid";

// 武器のアイコン。40.8 の弾の絵を SVG の rect で描く（設計書 40.10）
export const WeaponIcon = ({ weapon }: { readonly weapon: WeaponId }) => {
  const { runs, shift } = useMemo(() => { const grid = weaponIconGrid(weapon); return { runs: colorRuns(grid), shift: iconShift(grid) }; }, [weapon]);
  // 絵の中心をボタンの中央に合わせる。動かす量はアイコンの大きさに対する割合で、1px 単位に丸める。
  // 26 px と 52 px（1 art px = 2、4 px）では丸めずに中央に来る。39 px（3 px）では 1.5 px を丸め、ドットを px の境界に揃える
  const move = (art: number, size: number): string => `round(nearest, ${(art / size) * 100}%, 1px)`;
  return <svg viewBox={`${ICON_VIEW.left} ${ICON_VIEW.top} ${ICON_VIEW.width} ${ICON_VIEW.height}`} aria-hidden="true" shapeRendering="crispEdges"
    style={shift.x || shift.y ? { translate: `${move(shift.x, ICON_VIEW.width)} ${move(shift.y, ICON_VIEW.height)}` } : undefined}>
    {runs.map(r => <rect key={`${r.x}/${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={cssHex(r.color)} />)}
  </svg>;
};
