import { HP_MAX } from "@game/sim";
import { PALETTE } from "./palette";

// 機体の下の HP バー。設計書 40.5。接地点を原点とする art px で、接地点の 2 セル（8 art px）下に横 10 セル（40 art px）。
// 10 HP を 1 目盛りとし、輪郭と暗い地の上に 3 px の目盛りを 1 px の隙間で並べる。色は名前と同じチームの色。

export type PixelRect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly color: number };

const TICKS = 10;
const TICK_PX = 4;
const LEFT = -20;
const TOP = 8;

const ticksOf = (hp: number): number => Math.min(TICKS, Math.ceil(Math.max(0, hp) / (HP_MAX / TICKS)));

/** 塗る矩形を下から順に返す。ghost は減る前の HP で、ghostOn のときだけ失った区間を白く描く */
export const hpBarRects = (hp: number, ghost: number, ghostOn: boolean, fill: number): readonly PixelRect[] => {
  const shown = ticksOf(hp), lost = ghostOn ? Math.max(shown, ticksOf(ghost)) : shown;
  const tick = (i: number, color: number): PixelRect => ({ x: LEFT + i * TICK_PX, y: TOP, w: TICK_PX - 1, h: 4, color });
  return [
    { x: LEFT - 1, y: TOP - 1, w: TICKS * TICK_PX + 2, h: 6, color: PALETTE.outline },
    { x: LEFT, y: TOP, w: TICKS * TICK_PX, h: 4, color: PALETTE.sky0 },
    ...Array.from({ length: lost }, (_, i) => tick(i, i < shown ? fill : PALETTE.white)),
  ];
};
