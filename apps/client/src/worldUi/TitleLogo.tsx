import { useMemo } from "react";
import { cssHex } from "@/game/palette";
import { colorRuns, opaqueBounds } from "@/game/pixelGrid";
import { logoPixels } from "@/game/pixelFont";

// 題名「TANK SHOOT」のドット文字。設計書 40.10。絵は aria-hidden にし、見出しの文字は支援技術向けに残す。
export const TitleLogo = ({ text }: { readonly text: string }) => {
  const { runs, box } = useMemo(() => {
    const grid = logoPixels(text);
    return { runs: colorRuns(grid), box: opaqueBounds(grid) ?? { left: 0, top: 0, width: 1, height: 1 } };
  }, [text]);
  return <>
    <span className="visually-hidden">{text}</span>
    <svg className="title-logo" viewBox={`${box.left} ${box.top} ${box.width} ${box.height}`} aria-hidden="true" shapeRendering="crispEdges">
      {runs.map(r => <rect key={`${r.x}/${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={cssHex(r.color)} />)}
    </svg>
  </>;
};
