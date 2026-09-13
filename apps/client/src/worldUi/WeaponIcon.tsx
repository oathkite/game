import type { WeaponId } from "@game/protocol";

// Integer-aligned silhouettes stay legible without external artwork.
const shapes: Record<WeaponId, string> = {
  cannon: "M6 16h22v-4l8 8-8 8v-4H6z",
  triple: "M4 5h22v6H4z M10 17h26v6H10z M4 29h22v6H4z",
  multiple: "M5 5h6v6H5z M17 5h6v6h-6z M29 5h6v6h-6z M5 17h6v6H5z M17 17h6v6h-6z M29 17h6v6h-6z M5 29h6v6H5z M17 29h6v6h-6z M29 29h6v6h-6z",
  drill: "M4 14h10v12H4z M18 10l6 4v12l-6 4z M28 14l10 6-10 6z",
  laser: "M2 18h36v4H2z M8 8h4v6H8z M8 26h4v6H8z M28 8h4v6h-4z M28 26h4v6h-4z",
  digger: "M16 4h8v16h10L20 36 6 20h10z",
  floater: "M14 6h12v4h6v4h4v12h-4v4h-6v4H14v-4H8v-4H4V14h4v-4h6z M14 16v8h12v-8z",
  stinger: "M4 10l32 10L4 30l8-10z",
};
export const WeaponIcon = ({ weapon }: { readonly weapon: WeaponId }) =>
  <svg viewBox="0 0 40 40" aria-hidden="true" shapeRendering="crispEdges">
    <path d={shapes[weapon]} fill="currentColor" fillRule="evenodd" />
  </svg>;
