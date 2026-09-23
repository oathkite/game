// 画面の外で被弾した機体の向きを示す印。設計書 38 の E6。単位は画面の px。

export type EdgeSide = "left" | "right" | "up" | "down";
export type EdgeMarker = { readonly x: number; readonly y: number; readonly side: EdgeSide };

/** 画面の端から印までの余白 */
export const EDGE_MARGIN = 16;
/** 明滅の周期の半分 */
export const EDGE_BLINK_MS = 120;

/** 画面の中なら null。外なら、最も近い辺へ寄せた位置と向き */
export const edgeMarker = (point: { readonly x: number; readonly y: number }, screen: { readonly width: number; readonly height: number }, margin: number = EDGE_MARGIN): EdgeMarker | null => {
  const inside = point.x >= 0 && point.y >= 0 && point.x <= screen.width && point.y <= screen.height;
  if (inside) return null;
  const x = Math.min(screen.width - margin, Math.max(margin, point.x));
  const y = Math.min(screen.height - margin, Math.max(margin, point.y));
  const dx = point.x < 0 ? -point.x : point.x > screen.width ? point.x - screen.width : 0;
  const dy = point.y < 0 ? -point.y : point.y > screen.height ? point.y - screen.height : 0;
  const side: EdgeSide = dx >= dy ? (point.x < 0 ? "left" : "right") : point.y < 0 ? "up" : "down";
  return { x: Math.round(x), y: Math.round(y), side };
};

/** 印の明滅の点灯側 */
export const edgeBlinkOn = (elapsedMs: number, reduced: boolean): boolean => reduced || Math.floor(Math.max(0, elapsedMs) / EDGE_BLINK_MS) % 2 === 0;
