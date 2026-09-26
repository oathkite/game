import { Graphics } from "pixi.js";
import type { Target } from "@/practice/rules";
import { TARGET_HEIGHT } from "@/practice/rules";
import { ART_PER_CELL, colorRuns } from "./pixelGrid";
import { targetPixels } from "./targetSprite";

// 練習の的。絵は targetSprite.ts（設計書 40.8）。的が変わったときだけ描き直す。
const ART = 1 / ART_PER_CELL;

export const createTargetView = () => {
  const graphics = new Graphics();
  const runs = colorRuns(targetPixels());
  let previous: readonly Target[] | null = null;
  return { graphics, update: (targets: readonly Target[]) => {
    if (previous === targets) return;
    previous = targets;
    graphics.clear();
    for (const t of targets) {
      if (t.destroyed) continue;
      const y = t.y - TARGET_HEIGHT;
      for (const r of runs) graphics.rect(t.x + r.x * ART, y + r.y * ART, r.w * ART, ART).fill(r.color);
    }
  } };
};
