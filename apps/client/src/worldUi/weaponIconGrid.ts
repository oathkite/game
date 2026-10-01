import type { PlayerColor, WeaponId } from "@game/protocol";
import { TEAM_RAMPS } from "@/game/palette";
import { createGrid, getPixel, opaqueBounds, setPixel, TRANSPARENT, type PixelGrid } from "@/game/pixelGrid";
import { projectilePixels } from "@/game/projectileSprite";

// 武器のアイコンの絵。設計書 40.10。40.8 の右向きの弾の絵を、13 × 13 art px の枠の中心に置く。
// 52 CSS px のボタンで 1 art px = 4 px の整数になる。トリプル弾は 3 発、マルチ弾は 3 粒を並べる。

export const ICON_VIEW = { left: -6, top: -6, width: 13, height: 13 } as const;

const PLACES: Readonly<Partial<Record<WeaponId, readonly (readonly [number, number])[]>>> = {
  triple: [[-1, -4], [1, 0], [-1, 4]],
  multiple: [[-3, -3], [3, -3], [0, 3]],
};

export const weaponIconGrid = (weapon: WeaponId, color: PlayerColor = "green"): PixelGrid => {
  const grid = createGrid(ICON_VIEW.left, ICON_VIEW.top, ICON_VIEW.width, ICON_VIEW.height);
  const sprite = projectilePixels(weapon, TEAM_RAMPS[color], 0, 0);
  for (const [dx, dy] of PLACES[weapon] ?? [[0, weapon === "digger" ? 1 : 0]]) {
    for (let y = sprite.top; y < sprite.top + sprite.height; y++) for (let x = sprite.left; x < sprite.left + sprite.width; x++) {
      const c = getPixel(sprite, x, y);
      if (c !== TRANSPARENT) setPixel(grid, x + dx, y + dy, c);
    }
  }
  return grid;
};

/**
 * 絵の中心を表示の中心に合わせた表示範囲。大きさは ICON_VIEW のまま（1 art px を整数の px で描くため）。
 * 弾の絵は左右と上下で対称ではないので、枠の中心に置くと 0.5 から 1.5 art px ずれる。ずらす量は 0.5 art px 単位になる
 */
export type IconView = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
export const iconViewBox = (grid: PixelGrid): IconView => {
  const b = opaqueBounds(grid);
  if (!b) return ICON_VIEW;
  return { left: b.left + b.width / 2 - ICON_VIEW.width / 2, top: b.top + b.height / 2 - ICON_VIEW.height / 2, width: ICON_VIEW.width, height: ICON_VIEW.height };
};
