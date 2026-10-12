import { memo, useEffect, useRef } from "react";
import { MULTIPLAYER_MAPS, buildMapSpec } from "@game/maps";
import { cssHex, PALETTE } from "@/game/palette";

// Reuse the real collision terrain, including bridge openings and floating islands.
// 色は 40.4 のパレット。地表を緑、地中を 2 段の暗い緑の点描にする（設計書 45.6）
const SURFACE = cssHex(PALETTE.green), SOIL = cssHex(PALETTE.greenDeep), DEEP = cssHex(PALETTE.greenBlack);
const masks = new Map(MULTIPLAYER_MAPS.map(map => [map.id, buildMapSpec(map, 2).mask]));
export const RoomMapPreview = memo(({ mapId }: { readonly mapId: string }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, 160, 80);
    const mask = masks.get(mapId);
    if (!mask) return;
    for (let x = 0; x < 160; x++) for (let y = 0; y < 80; y++) {
      const mx = Math.floor(x * mask.width / 160), my = Math.floor(y * mask.height / 80);
      if (!mask.cells[my * mask.width + mx]) continue;
      const edge = my < 3 || !mask.cells[(my - 3) * mask.width + mx];
      context.fillStyle = edge ? SURFACE : (x * 7 + y * 11) % 13 < 3 ? SOIL : DEEP;
      context.fillRect(x, y, 1, 1);
    }
  }, [mapId]);
  return <div className="room-map-preview" aria-hidden="true">
    {mapId === "random" ? <span className="room-map-random">?</span> : <canvas ref={canvas} width={160} height={80} />}
  </div>;
});
