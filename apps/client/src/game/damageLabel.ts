import { COLOR_HEX, type TankColors } from "@game/protocol";
import { Container, Graphics, Text, type Ticker } from "pixi.js";
import { DAMAGE_LABEL_RISE_PX } from "./hitFeedback";

// 被弾した機体の上に浮くダメージ数字。設計書 03 の 3.9。拡大しない層に置き、自分で動いて消える。

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

/** 数字を出し、浮き上がって消えるまで自分で動く。返り値で途中でも消せる */
export const spawnDamageLabel = (init: DamageLabelInit): (() => void) => {
  const text = new Text({
    text: init.text,
    style: { fontFamily: "DotGothic16, monospace", fontSize: init.big ? 28 : 16, fill: init.big ? 0xffffff : COLOR_HEX[init.color], stroke: { color: 0x000000, width: 2 } },
    resolution: 1,
  });
  text.anchor.set(0.5, 1);
  text.position.set(init.x, init.y);
  init.parent.addChild(text);
  const sparks = new Graphics();
  if (init.big) init.parent.addChild(sparks);
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = init.summary || init.big ? 1200 : 1000;
  let elapsed = 0;
  const stop = (): void => {
    init.ticker.remove(step);
    sparks.destroy();
    if (!text.destroyed) text.destroy();
  };
  const step = (): void => {
    elapsed += init.ticker.deltaMS;
    const f = Math.min(1, elapsed / duration);
    text.position.y = init.y - DAMAGE_LABEL_RISE_PX * f;
    if (init.big && !reduced) {
      text.scale.set(1 + 0.35 * Math.max(0, 1 - elapsed / 180));
      sparks.clear();
      if (elapsed < 320) for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4, radius = 18 + elapsed * 0.1;
        sparks.rect(Math.round(init.x + Math.cos(angle) * radius), Math.round(init.y - 16 + Math.sin(angle) * radius), 4, 4).fill(0x33ff66);
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
  return stop;
};
