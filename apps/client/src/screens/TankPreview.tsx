import { COLOR_HEX, type TankColors } from "@game/protocol";

// 設定画面の戦車プレビュー。設計書 08 の 8.2。整数倍でだけ拡大し、大きく見せる。

type Props = {
  readonly colors: TankColors;
  readonly cell: number;
};

/** 幅 7、高さ 5 の絵と、長さ 4 の主砲（45 度）。1 が車体、2 が砲塔 */
const ROWS: readonly string[] = ["..222..", ".22222.", "1111111", "1111111", "1111111"];

export const TankPreview = ({ colors, cell }: Props) => {
  const w = 12 * cell;
  const h = 9 * cell;
  const cells: { x: number; y: number; c: string }[] = [];
  ROWS.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      if (ch === ".") return;
      cells.push({ x: (rx + 1) * cell, y: (ry + 4) * cell, c: ch === "1" ? COLOR_HEX[colors.primary] : COLOR_HEX[colors.secondary] });
    });
  });
  // 主砲は砲塔の付け根から右上へ 1 セルずつ
  for (let i = 1; i <= 4; i++) {
    cells.push({ x: (5 + i) * cell, y: (4 - i) * cell, c: COLOR_HEX[colors.secondary] });
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" data-testid="tank-preview">
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={cell} height={cell} fill={c.c} />
      ))}
    </svg>
  );
};
