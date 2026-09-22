import { describe, expect, it } from "vitest";
import { carve, maskFromHeights } from "@game/sim";
import { resolveTargets, challengeStatus } from "../src/practice/rules";
import { STAGES, createStageMask } from "../src/practice/stages";

describe("ターゲットチャレンジ", () => {
  const mask = maskFromHeights(Array(400).fill(180), 225);
  const target = { id: "a", x: 200, y: 180, destroyed: false };
  it("爆風が判定円に届けば破壊し、範囲外は残す", () => {
    expect(resolveTargets(mask, [target], [{ cx: 210, cy: 177, radius: 10 }])[0]?.destroyed).toBe(true);
    expect(resolveTargets(mask, [target], [{ cx: 220, cy: 177, radius: 10 }])[0]?.destroyed).toBe(false);
  });
  it("ダメージがなくても足元を失って落ちれば破壊する", () => {
    const after = carve(mask, { cx: 200, cy: 190, radius: 10 });
    expect(resolveTargets(after, [target], [])[0]?.destroyed).toBe(true);
    expect(target.destroyed).toBe(false);
  });
  it("最後の弾で全破壊ならクリア、的が残れば失敗", () => {
    expect(challengeStatus([{ ...target, destroyed: true }], 3, 3, false)).toBe("clear");
    expect(challengeStatus([target], 3, 3, false)).toBe("failed");
    expect(challengeStatus([target], 2, 3, false)).toBe("playing");
    expect(challengeStatus([target], 0, 3, true)).toBe("failed");
  });
  it("8面の地形と初期状態を独立して作る", () => {
    expect(STAGES).toHaveLength(8);
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(8);
    for (const stage of STAGES) {
      const a = createStageMask(stage);
      const b = createStageMask(stage);
      expect(a.cells).not.toBe(b.cells);
      expect(a.width).toBe(400);
      expect(stage.shots).toBeGreaterThan(0);
    }
  });
});
