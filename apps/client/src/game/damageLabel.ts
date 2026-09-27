import { COLOR_HEX, type TankColors } from "@game/protocol";
import { Container, Graphics, type Ticker } from "pixi.js";
import { damagePixels } from "./damageFont";
import { DAMAGE_LABEL_RISE_PX } from "./hitFeedback";
import { PALETTE } from "./palette";
import { colorRuns } from "./pixelGrid";

// 被弾した機体の上に浮くダメージ数字。設計書 03 の 3.9。拡大しない層に置き、自分で動いて消える。
// 数字は 5 × 7 のドット文字（damageFont.ts）で、1 画素を 2 px（直撃と合計は 3 px）の格子で描く（設計書 41.13）。

export type DamageLabelInit = {
  readonly parent: Container;
  readonly ticker: Ticker;
  readonly text: string;
  readonly color: TankColors["primary"];
  /** 直撃なら大きく出す */
  readonly big: boolean;
  readonly summary?: boolean;
  /** 開始位置（px）。y は文字の下端 */
  readonly x: number;
  readonly y: number;
  /** 消えたときに呼ぶ。途中で止めたときは呼ばない */
  readonly onEnd: () => void;
};

export type DamageLabel = {
  /** 途中でも消す */
  readonly stop: () => void;
  /** 同じ機体に新しい数字が出たとき、1 行ぶん上へ押し上げる（設計書 41 の段階 4） */
  readonly push: (px: number) => void;
};

/** 数字の 1 画素の大きさ（px）。直撃と合計は大きく、出た直後の 120 ms だけさらに 1 段大きくして弾ませる */
const DOT = 2, BIG_DOT = 3, POP_MS = 120;

/** 数字を grid の色の並びで描く。原点は文字の下端の中央 */
const drawDigits = (g: Graphics, text: string, dot: number, color: number): void => {
  const grid = damagePixels(text, dot, color);
  g.clear();
  for (const r of colorRuns(grid)) g.rect(r.x - Math.floor(grid.width / 2), r.y - grid.height, r.w, 1).fill(r.color);
};

/** 数字を出し、浮き上がって消えるまで自分で動く */
export const spawnDamageLabel = (init: DamageLabelInit): DamageLabel => {
  const text = new Graphics();
  const big = init.big || init.summary === true;
  const color = init.summary ? PALETTE.fire2 : init.big ? PALETTE.white : Number.parseInt(COLOR_HEX[init.color].slice(1), 16);
  let drawnDot = 0;
  const draw = (dot: number): void => { if (dot !== drawnDot) { drawDigits(text, init.text, dot, color); drawnDot = dot; } };
  draw(big ? BIG_DOT + 1 : DOT);
  text.position.set(Math.round(init.x), Math.round(init.y));
  init.parent.addChild(text);
  const sparks = new Graphics();
  if (init.big) init.parent.addChild(sparks);
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = init.summary || init.big ? 1200 : 1000;
  let elapsed = 0, lifted = 0;
  const stop = (): void => {
    init.ticker.remove(step);
    sparks.destroy();
    if (!text.destroyed) text.destroy();
  };
  const step = (): void => {
    elapsed += init.ticker.deltaMS;
    const f = Math.min(1, elapsed / duration);
    text.position.y = Math.round(init.y - lifted - DAMAGE_LABEL_RISE_PX * f);
    if (big) draw(elapsed < POP_MS && !reduced ? BIG_DOT + 1 : BIG_DOT);
    if (init.big && !reduced) {
      sparks.clear();
      if (elapsed < 320) for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4, radius = 18 + elapsed * 0.1;
        // 火花は数字と同じ色にする。緑は回復の色に読めた（設計書 41.13）
        sparks.rect(Math.round(init.x + Math.cos(angle) * radius), Math.round(init.y - 16 + Math.sin(angle) * radius), 4, 4).fill(color);
      }
    }
    // 後半で薄くなる
    text.alpha = f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4;
    if (f >= 1) {
      stop();
      init.onEnd();
    }
  };
  init.ticker.add(step);
  return { stop, push: (px) => { lifted += px; } };
};
