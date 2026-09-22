import { Graphics } from "pixi.js";
import type { Target } from "@/practice/rules";
import { TARGET_HEIGHT } from "@/practice/rules";

export const createTargetView = () => {
  const graphics = new Graphics();
  let previous: readonly Target[] | null = null;
  return { graphics, update: (targets: readonly Target[]) => {
    if (previous === targets) return;
    previous = targets;
    graphics.clear();
    for (const t of targets) {
      if (t.destroyed) continue;
      const y = t.y - TARGET_HEIGHT;
      graphics.rect(t.x - 0.5, y + 3, 1, 5).fill(0xb78d42);
      graphics.circle(t.x, y, 3).fill(0xffcc66);
      graphics.circle(t.x, y, 1.8).fill(0x241907);
      graphics.circle(t.x, y, 0.7).fill(0xffeeaa);
    }
  } };
};
