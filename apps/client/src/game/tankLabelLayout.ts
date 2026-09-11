type Point = { readonly x: number; readonly y: number };
type Size = { readonly width: number; readonly height: number };

/** Keep visible tanks' nameplates readable without turning offscreen labels into edge markers. */
export const fitTankLabel = (position: Point, tank: Point, bounds: Point & Size, viewport: Size): Point => {
  if (tank.x < 0 || tank.x > viewport.width || tank.y < 0 || tank.y > viewport.height) return position;
  const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
  return {
    x: clamp(position.x, 4 - bounds.x, viewport.width - 4 - bounds.x - bounds.width),
    y: clamp(position.y, 4 - bounds.y, viewport.height - 4 - bounds.y - bounds.height),
  };
};
