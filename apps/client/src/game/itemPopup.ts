import type { ItemId } from "@game/protocol";
import { Container, Graphics, type Ticker } from "pixi.js";
import { ITEM_ICON_ROWS } from "./itemIcons";
import { PALETTE } from "./palette";

// 相手がアイテムを使ったとき、撃った機体の上に出すアイコン（設計書 42.8）。
// ダメージ数字（damageLabel.ts）と同じく拡大しない層に置き、自分で動いて消える。

export type ItemPopupInit = {
  readonly parent: Container;
  readonly ticker: Ticker;
  readonly item: ItemId;
  /** 開始位置（px）。y は枠の下端 */
  readonly x: number;
  readonly y: number;
  /** 消えたときに呼ぶ。途中で止めたときは呼ばない */
  readonly onEnd: () => void;
};

export type ItemPopup = {
  readonly stop: () => void;
  readonly push: (px: number) => void;
};

/** 出ている時間、出た直後に弾む時間、浮き上がる高さ */
export const ITEM_POPUP_MS = 1500;
const POP_MS = 120, RISE_PX = 16;
/** アイコンの 1 画素の大きさ（px）。弾む間だけ 1 段大きくする */
const DOT = 3;
/** 枠の太さと、枠とアイコンの隙間（px） */
const BORDER = 2, PAD = 2;
/** 枠の色。テレポートは光の柱と同じ発光色、ダブルシュートは爆発の黄（設計書 42.3、41） */
const FRAME: Readonly<Record<ItemId, number>> = { double: PALETTE.fire2, teleport: PALETTE.energy1 };

export type ItemPopupPose = { readonly dot: number; readonly rise: number; readonly alpha: number };

/** 出てから elapsed ms の姿。動きを減らす設定では弾まず浮かず、後半で薄くなるだけにする */
export const itemPopupPose = (elapsed: number, reduced: boolean): ItemPopupPose => {
  const f = Math.min(1, Math.max(0, elapsed) / ITEM_POPUP_MS);
  return {
    dot: !reduced && elapsed < POP_MS ? DOT + 1 : DOT,
    rise: reduced ? 0 : Math.round(RISE_PX * Math.min(1, f * 3)),
    alpha: f < 0.7 ? 1 : Math.max(0, (1 - f) / 0.3),
  };
};

/** 枠とアイコンを描く。原点は枠の下端の中央 */
const drawPopup = (g: Graphics, item: ItemId, dot: number): void => {
  const rows = ITEM_ICON_ROWS[item], inner = rows.length * dot + PAD * 2, outer = inner + BORDER * 2;
  const left = -Math.floor(outer / 2), top = -outer;
  g.clear();
  g.rect(left, top, outer, outer).fill(FRAME[item]);
  g.rect(left + BORDER, top + BORDER, inner, inner).fill(PALETTE.black);
  rows.forEach((row, y) => [...row].forEach((v, x) => {
    if (v === "1") g.rect(left + BORDER + PAD + x * dot, top + BORDER + PAD + y * dot, dot, dot).fill(PALETTE.white);
  }));
};

/** アイコンを出し、浮き上がって消えるまで自分で動く */
export const spawnItemPopup = (init: ItemPopupInit): ItemPopup => {
  const g = new Graphics();
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let elapsed = 0, lifted = 0, drawnDot = 0;
  const apply = (): void => {
    const pose = itemPopupPose(elapsed, reduced);
    if (pose.dot !== drawnDot) { drawPopup(g, init.item, pose.dot); drawnDot = pose.dot; }
    g.position.set(Math.round(init.x), Math.round(init.y - lifted - pose.rise));
    g.alpha = pose.alpha;
  };
  apply();
  init.parent.addChild(g);
  const stop = (): void => {
    init.ticker.remove(step);
    if (!g.destroyed) g.destroy();
  };
  const step = (): void => {
    elapsed += init.ticker.deltaMS;
    apply();
    if (elapsed >= ITEM_POPUP_MS) {
      stop();
      init.onEnd();
    }
  };
  init.ticker.add(step);
  return { stop, push: (px) => { lifted += px; } };
};
