import { isPaletteColor } from "@/game/palette";

/**
 * 固定パレットに無い色を、重複を除いて 16 進で返す。`expect(offPalette(...)).toEqual([])` で 1 回だけ比べる。
 * 画素ごとに expect を呼ぶと 1 枚で数万回になり、CI で既定の制限時間を超える（設計書 7.5）。
 */
export const offPalette = (colors: Iterable<number>): string[] => {
  const off = new Set<number>();
  for (const color of colors) if (!isPaletteColor(color)) off.add(color);
  return [...off].map(color => `0x${color.toString(16)}`);
};
