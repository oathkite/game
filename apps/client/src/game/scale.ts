import { MAP_HEIGHT, MAP_WIDTH } from "@game/sim";

// 設計書 03 の 3.1。1 セルを何 px で描くかは、画面に収まる最大の整数にする。

/** 基準表示のパネル幅（セル） */
export const PANEL_CELLS = 24;

export type Layout = {
  /** 1 セルの px */
  readonly cell: number;
  readonly panelWidth: number;
  readonly mapWidth: number;
  readonly mapHeight: number;
};

export const computeLayout = (viewportWidth: number, viewportHeight: number): Layout => {
  const byWidth = Math.floor(viewportWidth / (MAP_WIDTH + PANEL_CELLS * 2));
  const byHeight = Math.floor(viewportHeight / MAP_HEIGHT);
  const cell = Math.max(1, Math.min(byWidth, byHeight));
  return {
    cell,
    panelWidth: PANEL_CELLS * cell,
    mapWidth: MAP_WIDTH * cell,
    mapHeight: MAP_HEIGHT * cell,
  };
};
