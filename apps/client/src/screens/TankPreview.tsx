import { COLOR_HEX, type Loadout, type TankColors } from "@game/protocol";
import { loadoutRects } from "@/game/weaponArt";

// 設定画面の戦車プレビュー。設計書 08 の 8.2、10 の 10.5。整数倍でだけ拡大し、大きく見せる。
// 主砲とサブウェポンの部品は対戦画面と同じ形（weaponArt）を、45 度の主砲は 1 セルずつの階段で描く。

type Props = {
  readonly colors: TankColors;
  readonly loadout: Loadout;
  readonly cell: number;
};

/** 幅 7、高さ 5 の絵。1 が車体、2 が砲塔 */
const ROWS: readonly string[] = ["..222..", ".22222.", "1111111", "1111111", "1111111"];
/** 接地点（車体下端中央）の絵の中での位置（セル） */
const ORIGIN_X = 4.5;
const ORIGIN_Y = 9;

export const TankPreview = ({ colors, loadout, cell }: Props) => {
  const w = 12 * cell;
  const h = 10 * cell;
  const primary = COLOR_HEX[colors.primary];
  const secondary = COLOR_HEX[colors.secondary];
  const rects: { x: number; y: number; w: number; h: number; c: string }[] = [];
  ROWS.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      if (ch === ".") return;
      rects.push({ x: (rx + 1) * cell, y: (ry + 5) * cell, w: cell, h: cell, c: ch === "1" ? primary : secondary });
    });
  });
  const art = loadoutRects(loadout);
  // 主砲は付け根（接地点の真上 4 セル）から右上へ 45 度の階段。1 段が砲身 1 セルで、段の正方形の大きさで太さを表す
  for (const r of art.barrel) {
    for (let i = Math.floor(r.x) + 1; i <= Math.ceil(r.x + r.w); i++) {
      const cx = ORIGIN_X + 1 + i;
      const cy = ORIGIN_Y - 3.5 - i;
      rects.push({ x: (cx - r.h / 2) * cell, y: (cy - r.h / 2) * cell, w: r.h * cell, h: r.h * cell, c: secondary });
    }
  }
  for (const r of art.pod) rects.push({ x: (ORIGIN_X + r.x) * cell, y: (ORIGIN_Y + r.y) * cell, w: r.w * cell, h: r.h * cell, c: primary });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" data-testid="tank-preview">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.c} />
      ))}
    </svg>
  );
};
