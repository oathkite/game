import { getMap } from "../src/index.js";
import { describe, expect, it } from "vitest";
import { simulateShot } from "@game/sim";

// 設計書 07 の開発順序 4「谷で遊び、面白さを確認する」の数値による裏付け。
// 遊びの判断そのものは人が行うが、設計書 01 の判断基準「風を読み切って狙った場所に当てた報い」が成り立つ条件を固定する。
// 谷のスポーンから相手に届く照準の数が、風 0 と風 10 で大きく入れ替わることを確認する。

const valley = getMap("valley");

const hitting = (wind: number): Set<string> => {
  const mask = valley.build();
  const [x0, x1] = valley.spawns;
  const out = new Set<string>();
  for (let elevation = 20; elevation <= 80; elevation++) {
    for (let power = 40; power <= 100; power++) {
      const r = simulateShot(mask, [{ x: x0, hp: 100 }, { x: x1, hp: 100 }], { seat: 0, x: x0, facing: 1, elevation, power, wind }).result;
      if (r.damage[1] > 0) out.add(`${elevation}/${power}`);
    }
  }
  return out;
};

describe("谷の手触り", () => {
  const calm = hitting(0);
  const gusty = hitting(10);

  it("無風でも当たる照準は全体の数パーセントに限られ、狙う価値がある", () => {
    const total = 61 * 61;
    expect(calm.size).toBeGreaterThan(20);
    expect(calm.size / total).toBeLessThan(0.1);
  });

  it("風 10 では無風の照準の大半が外れ、風を読み直す必要がある", () => {
    const survived = [...calm].filter((k) => gusty.has(k)).length;
    expect(survived / calm.size).toBeLessThan(0.5);
    expect(gusty.size).toBeGreaterThan(20);
  });

  it("当てた 1 発で相手の足元の地表が下がり、削って落とす勝ち筋が成立する", () => {
    const [x0, x1] = valley.spawns;
    const mask = valley.build();
    const surfaceAt = (m: typeof mask, x: number): number => {
      for (let y = 0; y < m.height; y++) if (m.cells[y * m.width + x] === 1) return y;
      return m.height;
    };
    // 当たる照準の中に、相手の真下の地表を下げるものがある
    const lowers = [...calm].some((k) => {
      const [elevation, power] = k.split("/").map(Number) as [number, number];
      const r = simulateShot(mask, [{ x: x0, hp: 100 }, { x: x1, hp: 100 }], { seat: 0, x: x0, facing: 1, elevation, power, wind: 0 });
      return surfaceAt(r.mask, x1) > surfaceAt(mask, x1);
    });
    expect(lowers).toBe(true);
  });
});
