import { Graphics } from "pixi.js";

// 操作中の自機の名前の上に出す下向きのキャレット。設計書 03 の 3.7。
// 名前と同じく拡大しない層に px で描き、ドットの大きさは 2 px に揃える。

const DOT = 2;
/** 上下に 1 往復する周期 */
export const CARET_PERIOD_MS = 800;
/** 名前の文字の下端からキャレットの下端までの高さ。16 px の文字の上に隙間を空ける */
const CARET_BOTTOM_PX = -24;

/** 経過時間に対する上への浮き（px）。0、-2、-4 のドット単位で動かし、動きを減らす設定では止める */
export const caretBob = (elapsedMs: number, reduced: boolean): number => {
  if (reduced) return 0;
  const dots = Math.round(1 + Math.sin((elapsedMs / CARET_PERIOD_MS) * 2 * Math.PI));
  return dots === 0 ? 0 : -DOT * dots;
};

/** 幅 7、5、3、1 ドットの逆三角形。黒い 1 ドットの縁で地形や空の上でも読めるようにする。下端が原点 */
export const createTurnCaret = (color: number): Graphics => {
  const g = new Graphics();
  const rows = (widths: readonly number[], top: number, fill: number): void => {
    widths.forEach((w, i) => g.rect((-w * DOT) / 2, (top + i) * DOT, w * DOT, DOT).fill(fill));
  };
  rows([9, 9, 7, 5, 3, 1], -6, 0x000000);
  rows([7, 5, 3, 1], -5, color);
  g.position.set(0, CARET_BOTTOM_PX);
  g.visible = false;
  return g;
};

/** キャレットを経過時間に応じた高さへ置く */
export const placeTurnCaret = (caret: Graphics, elapsedMs: number, reduced: boolean): void => {
  caret.y = CARET_BOTTOM_PX + caretBob(elapsedMs, reduced);
};
