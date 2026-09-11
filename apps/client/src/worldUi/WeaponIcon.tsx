import type { WeaponId } from "@game/protocol";

const urls = import.meta.glob<string>("../../../../assets/runtime/tanks-v1/projectile-*.png", { eager: true, query: "?url", import: "default" });
// Transparent margins in the gameplay sheets are excluded from the HUD viewport.
const bounds: Record<WeaponId, string> = {
  cannon: "84 90 24 11",
  triple: "92 94 9 4",
  multiple: "93 93 6 6",
  drill: "84 90 24 13",
  laser: "79 93 34 5",
  digger: "86 78 26 29",
  floater: "87 87 18 17",
  stinger: "80 92 32 7",
};

export const WeaponIcon = ({ weapon }: { readonly weapon: WeaponId }) => {
  const url = urls[`../../../../assets/runtime/tanks-v1/projectile-${weapon}.png`];
  const positions = weapon === "triple" ? [[0, 14, 24], [8, 6, 24], [16, 14, 24]]
    : weapon === "multiple" ? Array.from({ length: 9 }, (_, i) => [1 + (i % 3) * 13, 1 + Math.floor(i / 3) * 13, 12])
    : [[2, 2, 36]];
  return <svg viewBox="0 0 40 40" aria-hidden="true" style={{ imageRendering: "pixelated" }}>
    <g transform={weapon === "multiple" || weapon === "floater" || weapon === "digger" ? undefined : "rotate(-35 20 20)"}>
    {positions.map(([x, y, size], index) => <svg key={index} x={x} y={y} width={size} height={size} viewBox={bounds[weapon]}>
      <image href={url} width="192" height="160" />
    </svg>)}
    </g>
  </svg>;
};
