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
  it("的がまだ無ければクリアにしない（チュートリアルは途中で的を出す）", () => {
    expect(challengeStatus([], 1, 3, false)).toBe("playing");
    expect(challengeStatus([], 3, 3, false)).toBe("failed");
  });
  it("8面の地形と初期状態を独立して作る", () => {
    expect(STAGES).toHaveLength(8);
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(8);
    const solidCount = (cells: Uint8Array) => cells.reduce((n, c) => n + c, 0);
    for (const stage of STAGES) {
      const a = createStageMask(stage);
      const b = createStageMask(stage);
      const solid = solidCount(b.cells);
      expect(solid).toBeGreaterThan(0);
      // 片方を壊しても、もう片方の地形が残ることで独立を確かめる。
      // cells の not.toBe は同じ配列かどうかしか見ないが、これなら同じ ArrayBuffer を共有する別の配列も捕まえる。
      a.cells.fill(0);
      expect(solidCount(b.cells)).toBe(solid);
      expect(a.width).toBe(400);
      expect(stage.shots).toBeGreaterThan(0);
    }
  });
});
