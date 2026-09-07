import { COLOR_HEX, type TankColors } from "@game/protocol";

// 設定画面の戦車プレビュー。設計書 08 の 8.2。整数倍でだけ拡大し、大きく見せる。
// 武器で形は変えない（設計書 10 の 10.5）。

type Props = {
  readonly colors: TankColors;
  readonly cell: number;
};

/** 幅 7、高さ 5 の絵。1 が車体、2 が砲塔 */
const ROWS: readonly string[] = ["..222..", ".22222.", "1111111", "1111111", "1111111"];
/** 45 度の主砲。付け根（接地点の真上 4 セル）から右上へ 1 セルずつの階段 */
const BARREL_CELLS = 4;

export const TankPreview = ({ colors, cell }: Props) => {
  const w = 12 * cell;
  const h = 10 * cell;
  const primary = COLOR_HEX[colors.primary];
  const secondary = COLOR_HEX[colors.secondary];
  const rects: { x: number; y: number; c: string }[] = [];
  ROWS.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      if (ch === ".") return;
      rects.push({ x: (rx + 1) * cell, y: (ry + 5) * cell, c: ch === "1" ? primary : secondary });
    });
  });
  for (let i = 1; i <= BARREL_CELLS; i++) rects.push({ x: (5 + i) * cell, y: (5 - i) * cell, c: secondary });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" data-testid="tank-preview">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={cell} height={cell} fill={r.c} />
      ))}
    </svg>
  );
};
