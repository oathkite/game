import type { WeaponId } from "@game/protocol";

const urls = import.meta.glob<string>("../../../../assets/runtime/tanks-v1/projectile-*.png", { eager: true, query: "?url", import: "default" });
// Transparent margins in the gameplay sheets are excluded from the HUD viewport.
const bounds: Record<WeaponId, string> = {
  cannon: "82 88 28 15",
  triple: "90 92 13 8",
  multiple: "91 91 10 10",
  drill: "82 88 28 17",
  laser: "77 91 38 9",
  digger: "84 76 30 33",
  floater: "85 85 22 21",
  stinger: "78 90 36 11",
};

export const WeaponIcon = ({ weapon }: { readonly weapon: WeaponId }) => {
  const url = urls[`../../../../assets/runtime/tanks-v1/projectile-${weapon}.png`];
  const positions = weapon === "triple" ? [[1, 20, 17], [11, 7, 17], [22, 20, 17]]
    : weapon === "multiple" ? Array.from({ length: 9 }, (_, i) => [1 + (i % 3) * 13, 1 + Math.floor(i / 3) * 13, 12])
    : [[2, 2, 36]];
  return <svg viewBox="0 0 40 40" aria-hidden="true" style={{ imageRendering: "pixelated" }}>
    {positions.map(([x, y, size], index) => <svg key={index} x={x} y={y} width={size} height={size} viewBox={bounds[weapon]}>
      <image href={url} width="192" height="160" />
    </svg>)}
  </svg>;
};
