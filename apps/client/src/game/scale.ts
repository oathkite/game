import { MAP_HEIGHT, MAP_WIDTH } from "@game/sim";

// 設計書 03 の 3.1。パネルは指が届く幅を先に確保し、残った領域にマップを収まる限り大きく描く。
// 倍率は整数に丸めない。小さな画面で 1 px 刻みに丸めると、画面の半分近くが余白になるためである。

/** 基準表示のパネル幅（セル） */
export const PANEL_CELLS = 24;

/** 指で押せる最小の大きさ（px）。十字キーの 1 ボタンがこれを下回らないようにする */
export const TOUCH_MIN = 44;

/** パネルの最小幅（px）。十字キーの 3 列がタップできる幅と、左右 4 px の余白 */
export const PANEL_MIN = TOUCH_MIN * 3 + 8;

/** パネル 2 枚が画面から奪ってよい幅の割合。残りがマップになる */
const PANEL_SHARE_MAX = 0.4;

export type Layout = {
  /** マップの 1 セルの px。整数とは限らない */
  readonly cell: number;
  readonly panelWidth: number;
  readonly mapWidth: number;
  readonly mapHeight: number;
  /** パネルの中で 1 セル相当として使う px。マップの cell とは独立に決める */
  readonly panelCell: number;
};

export const computeLayout = (viewportWidth: number, viewportHeight: number): Layout => {
  // マップ 400 セルとパネル 24 セル 2 枚で画面を分けたときのパネル幅を基準にする。
  // 狭い画面ではこれが指の幅を割るので、下限を優先してマップを譲る
  const byShare = (viewportWidth / (MAP_WIDTH + PANEL_CELLS * 2)) * PANEL_CELLS;
  const cap = (viewportWidth * PANEL_SHARE_MAX) / 2;
  const panelWidth = Math.max(1, Math.floor(Math.min(Math.max(byShare, PANEL_MIN), cap)));
  const forMap = Math.max(1, viewportWidth - panelWidth * 2);
  // 幅と高さのどちらか厳しい方に合わせる
  const cell = Math.max(0.01, Math.min(forMap / MAP_WIDTH, viewportHeight / MAP_HEIGHT));
  return {
    cell,
    panelWidth,
    mapWidth: Math.floor(MAP_WIDTH * cell),
    mapHeight: Math.floor(MAP_HEIGHT * cell),
    panelCell: panelWidth / PANEL_CELLS,
  };
};
