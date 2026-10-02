import { describe, expect, it } from "vitest";
import { simulateCombat, simulateCombatWithItem, simulateShot, type Combatant } from "../src/ballistics";
import { DOUBLE_GAP_TICKS, simulateConcurrentCombat, simulateConcurrentCombatWithItem } from "../src/concurrent";
import { muzzleOf } from "../src/flight";
import { flatMask, shot, slabMask, wallMask } from "../src/fixtures";
import { isRingOut, spawnPos } from "../src/tank";
import { createMask, maskFromHeights, type TerrainMask } from "../src/terrain";
import { teleportLanding } from "../src/teleport";

// アイテム（設計書 42）。ダブルシュートは落下後の位置からもう一度撃ち、テレポートは削らずに着地点へ移る。

const on = (mask: TerrainMask, x: number, hp = 100): Combatant => ({ ...spawnPos(mask, x), hp });

/** 参照の実装。1 発目を撃ち、全員を落とした後の位置と HP から、撃った側がもう一度撃つ */
const twice = (mask: TerrainMask, players: readonly Combatant[], shooter: number, input: ReturnType<typeof shot>) => {
  const first = simulateCombat(mask, players, input, false);
  const after = players.map((p, i) => ({ ...first.positions[i]!, hp: first.hpAfter[i]! }));
  const second = simulateCombat(first.mask, after, { ...input, ...first.positions[shooter]! }, false);
  return { first, second };
};

describe("ダブルシュート", () => {
  it("1 発目の地形と HP の上で、同じ仰角とパワーでもう一度撃つ", () => {
    const mask = flatMask();
    const players = [on(mask, 60), on(mask, 150)];
    const input = shot({ elevation: 45, power: 50, item: "double" });
    const out = simulateCombatWithItem(mask, players, 0, input, false);
    const { first, second } = twice(mask, players, 0, input);
    expect(out.impacts).toHaveLength(2);
    expect(out.impacts.map(i => i.projectile)).toEqual([0, 1]);
    expect(out.impacts[1]).toEqual({ ...second.impacts[0]!, projectile: 1 });
    expect(out.paths).toEqual([...first.paths, ...second.paths]);
    expect(out.mask.cells).toEqual(second.mask.cells);
    expect(out.hpAfter).toEqual(second.hpAfter);
    // 1 発目の穴に落ちた相手に、2 発目がもう一度当たる
    expect(out.hpAfter[1]!).toBeLessThan(first.hpAfter[1]!);
  });

  it("2 発目を撃ったら、1 発目の弾道の本数と、1 発目で全員が落ちた後の位置を持つ", () => {
    const mask = flatMask();
    const players = [on(mask, 60), on(mask, 150)];
    const input = shot({ elevation: 45, power: 50, item: "double" });
    const { first } = twice(mask, players, 0, input);
    const out = simulateCombatWithItem(mask, players, 0, input, false);
    expect(out.firstShot).toEqual({ paths: 1, positions: first.positions });
    expect(first.positions[1]!.y).toBeGreaterThan(150);
    expect("firstShot" in simulateCombatWithItem(mask, [on(mask, 60), on(mask, 150, 1)], 0, input, false)).toBe(false);
  });

  it("扇の武器は弾道をすべてもう一度撃ち、2 発目の弾道の番号は 1 発目の続きになる", () => {
    const mask = flatMask();
    const out = simulateCombatWithItem(mask, [on(mask, 60), on(mask, 300)], 0, shot({ weapon: "triple", item: "double" }), false);
    expect(out.paths).toHaveLength(6);
    expect([...new Set(out.impacts.map(i => i.projectile))]).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("1 発目で足元が削れて落ちたら、落ちた後の位置と傾きから撃つ", () => {
    const mask = wallMask(104, 130);
    const players = [on(mask, 100), on(mask, 300)];
    const input = shot({ x: 100, y: 150, elevation: 10, power: 50, item: "double" });
    const { first } = twice(mask, players, 0, input);
    expect(first.positions[0]!.y).toBeGreaterThan(150);
    const out = simulateCombatWithItem(mask, players, 0, input, false);
    const muzzle = muzzleOf(first.mask, first.positions[0]!, 1, 10).position;
    const secondStart = out.paths[1]!.points[0];
    expect(secondStart).toEqual(muzzle);
    expect(secondStart).not.toEqual(out.paths[0]!.points[0]);
  });

  it("1 対 1 で 1 発目に相手が倒れたら、試合が決まったので 2 発目を撃たない", () => {
    const mask = flatMask();
    const players = [on(mask, 60), on(mask, 150, 1)];
    const input = shot({ elevation: 45, power: 50 });
    const single = simulateCombat(mask, players, input, false);
    expect(single.hpAfter[1]!).toBeLessThanOrEqual(0);
    expect(simulateCombatWithItem(mask, players, 0, { ...input, item: "double" }, false)).toEqual(single);
  });

  it("1 発目で撃った側が倒れたら 2 発目を撃たない", () => {
    const mask = wallMask(104, 130);
    const players = [on(mask, 100, 1), on(mask, 300)];
    const input = shot({ x: 100, y: 150, elevation: 10, power: 50 });
    const single = simulateCombat(mask, players, input, false);
    expect(single.hpAfter[0]!).toBeLessThanOrEqual(0);
    expect(simulateCombatWithItem(mask, players, 0, { ...input, item: "double" }, false)).toEqual(single);
  });

  it("1 発目で撃った側が奈落へ落ちたら 2 発目を撃たない", () => {
    // 3 セルの薄い板の上で真下に撃つと、自分に当たって板を抜く
    const mask = slabMask([[40, 120]], 150, 3);
    const players = [on(mask, 80), on(mask, 110)];
    const input = shot({ x: 80, y: 150, elevation: 90, power: 0 });
    const single = simulateCombat(mask, players, input, false);
    expect(isRingOut(single.mask, single.positions[0]!)).toBe(true);
    expect(single.hpAfter[0]!).toBeGreaterThan(0);
    expect(simulateCombatWithItem(mask, players, 0, { ...input, item: "double" }, false)).toEqual(single);
  });
});

describe("テレポートの着地点", () => {
  it("当たる直前の空きセルの列で、そこから下の最初の地面に立つ", () => {
    const mask = flatMask();
    expect(teleportLanding(mask, { x: 200, y: 149 })).toEqual({ x: 200, y: 150 });
    expect(teleportLanding(mask, { x: 200, y: -5 })).toEqual({ x: 200, y: 150 });
  });

  it("天井の下で機体の高さぶん空いていなければ着地しない", () => {
    const mask = maskFromHeights(Array.from({ length: 400 }, () => 150), 225);
    // y = 145 に天井。床 150 との間は 4 セルで、機体の高さ 6 に足りない
    for (let x = 190; x <= 210; x++) mask.cells[145 * 400 + x] = 1;
    expect(teleportLanding(mask, { x: 200, y: 147 })).toBeNull();
    // 天井の上なら立てる
    expect(teleportLanding(mask, { x: 200, y: 140 })).toEqual({ x: 200, y: 145 });
  });

  it("下に地面が無い列には着地しない", () => {
    expect(teleportLanding(createMask(400, 225), { x: 200, y: 100 })).toBeNull();
  });
});

describe("テレポート", () => {
  it("地形を削らずダメージも出さず、撃った側だけが着弾の手前へ移る", () => {
    const mask = flatMask();
    const players = [on(mask, 60), on(mask, 300)];
    const input = shot({ elevation: 45, power: 60 });
    const normal = simulateCombat(mask, players, input, false);
    const out = simulateCombatWithItem(mask, players, 0, { ...input, item: "teleport" }, false);
    expect(out.impacts).toEqual([]);
    expect(out.mask.cells).toEqual(mask.cells);
    expect(out.hpAfter).toEqual([100, 100]);
    expect(out.paths).toHaveLength(1);
    expect(out.paths[0]!.impactAt).toEqual([]);
    const hit = normal.impacts[0]!.cell;
    expect(out.teleport).not.toBeNull();
    expect(Math.abs(out.teleport!.x - hit.x)).toBeLessThanOrEqual(1);
    expect(out.teleport!.y).toBe(150);
    expect(out.positions).toEqual([out.teleport, { x: 300, y: 150 }]);
    expect(out.ringOut).toEqual([]);
  });

  it("相手の機体に当たったら、相手を傷つけずにその隣へ移る", () => {
    const mask = flatMask();
    const out = simulateCombatWithItem(mask, [on(mask, 60), on(mask, 72)], 0, shot({ elevation: 10, power: 40, item: "teleport" }), false);
    expect(out.hpAfter).toEqual([100, 100]);
    expect(out.teleport).not.toBeNull();
    expect(Math.abs(out.teleport!.x - 72)).toBeLessThanOrEqual(4);
  });

  it("弾がマップの外へ消えたら移らない", () => {
    const mask = flatMask();
    const players = [on(mask, 390), on(mask, 60)];
    const out = simulateCombatWithItem(mask, players, 0, shot({ x: 390, elevation: 10, power: 100, item: "teleport" }), false);
    expect(out.teleport).toBeNull();
    expect(out.positions).toEqual([{ x: 390, y: 150 }, { x: 60, y: 150 }]);
  });

  it("砲口が壁の中なら移らない", () => {
    const mask = wallMask(104, 130);
    const out = simulateCombatWithItem(mask, [on(mask, 100), on(mask, 300)], 0, shot({ x: 100, elevation: 10, power: 50, item: "teleport" }), false);
    expect(out.teleport).toBeNull();
    expect(out.positions[0]).toEqual({ x: 100, y: 150 });
  });

  it("扇の武器を渡されても弾道は 1 本だけ飛ぶ", () => {
    const mask = flatMask();
    const out = simulateCombatWithItem(mask, [on(mask, 60), on(mask, 300)], 0, shot({ weapon: "multiple", item: "teleport" }), false);
    expect(out.paths).toHaveLength(1);
  });
});

describe("2 人対戦の射撃結果（v1）", () => {
  it("テレポートの着地点を結果に持ち、撃った側の位置に反映する", () => {
    const mask = flatMask();
    const r = simulateShot(mask, [on(mask, 60), on(mask, 300)], shot({ item: "teleport" })).result;
    expect(r.input.item).toBe("teleport");
    expect(r.teleport).not.toBeNull();
    expect([r.xAfter[0], r.yAfter[0]]).toEqual([r.teleport!.x, r.teleport!.y]);
    expect(r.impacts).toEqual([]);
    expect(r.finished).toBeNull();
  });

  it("ダブルシュートで 2 発目を撃ったら、1 発目の終わりの位置を持つ", () => {
    const mask = flatMask();
    const players = [on(mask, 60), on(mask, 150)] as const;
    const input = shot({ elevation: 45, power: 50, item: "double" });
    const out = simulateShot(mask, players, input);
    expect(out.firstShot).toEqual(simulateCombatWithItem(mask, players, 0, input, false).firstShot);
    expect("firstShot" in simulateShot(mask, players, shot({ elevation: 45, power: 50 }))).toBe(false);
  });

  it("アイテムを使わない射撃の結果にはテレポートの項目を持たない", () => {
    const mask = flatMask();
    expect("teleport" in simulateShot(mask, [on(mask, 60), on(mask, 300)], shot()).result).toBe(false);
    expect("teleport" in simulateShot(mask, [on(mask, 60), on(mask, 300)], shot({ item: "double" })).result).toBe(false);
  });
});

describe("多人数の同時処理（v2）", () => {
  const players = [{ x: 60, y: 150, hp: 100 }, { x: 72, y: 150, hp: 100 }, { x: 300, y: 150, hp: 100 }];

  it("ダブルシュートは 1 発目が終わってから間を置いて 2 発目を撃つ", () => {
    const input = shot({ elevation: 10, power: 40 });
    const first = simulateConcurrentCombat(flatMask(), players, input);
    const after = players.map((p, i) => ({ ...first.positions[i]!, hp: first.hpAfter[i]! }));
    const second = simulateConcurrentCombat(first.mask, after, { ...input, ...first.positions[0]! });
    const out = simulateConcurrentCombatWithItem(flatMask(), players, 0, { ...input, item: "double" });
    const offset = first.ticks + DOUBLE_GAP_TICKS;
    expect(out.paths.map(p => p.launchTick)).toEqual([0, offset]);
    expect(out.paths[1]!.pointTicks).toEqual(second.paths[0]!.pointTicks.map(t => t + offset));
    expect(out.impacts.map(i => [i.projectile, i.tick])).toEqual([[0, first.impacts[0]!.tick], [1, second.impacts[0]!.tick + offset]]);
    expect(out.ticks).toBe(offset + second.ticks);
    expect(out.firstShot).toEqual({ paths: 1, positions: first.positions, tick: first.ticks });
    expect(out.hpAfter).toEqual(second.hpAfter);
    expect(out.mask.cells).toEqual(second.mask.cells);
  });

  // 1 発目で 72 の相手が倒れる配置。300 の機体は爆風の外にいる
  const input = shot({ elevation: 10, power: 40 });
  const targetDown = (teams: readonly string[]) =>
    [{ x: 60, y: 150, hp: 100 }, { x: 72, y: 150, hp: 1 }, { x: 300, y: 150, hp: 100 }].map((p, i) => ({ ...p, team: teams[i]! }));

  it("狙った相手が倒れても、ほかの敵が残っていれば試合が続くので 2 発目を撃つ", () => {
    for (const teams of [["a", "b", "c"], ["a", "b", "b"]]) {
      const first = simulateConcurrentCombat(flatMask(), targetDown(teams), input);
      expect(first.hpAfter[1]!).toBeLessThanOrEqual(0);
      expect(simulateConcurrentCombatWithItem(flatMask(), targetDown(teams), 0, { ...input, item: "double" }).paths).toHaveLength(2);
    }
  });

  it("1 発目で敵のチームが残らなければ、試合が決まったので 2 発目を撃たない", () => {
    const players = targetDown(["a", "b", "a"]);
    expect(simulateConcurrentCombatWithItem(flatMask(), players, 0, { ...input, item: "double" })).toEqual(simulateConcurrentCombat(flatMask(), players, input));
  });

  it("1 発目で撃った側が倒れたら 2 発目を撃たない", () => {
    const mask = wallMask(104, 130);
    const weak = [{ x: 100, y: 150, hp: 1 }, { x: 300, y: 150, hp: 100 }];
    const input = shot({ x: 100, elevation: 10, power: 50 });
    expect(simulateConcurrentCombatWithItem(mask, weak, 0, { ...input, item: "double" })).toEqual(simulateConcurrentCombat(mask, weak, input));
  });

  it("テレポートは 1 tick に 1 点ずつ進む弾道を持ち、着弾を持たない", () => {
    const out = simulateConcurrentCombatWithItem(flatMask(), players, 2, shot({ x: 300, facing: -1, item: "teleport" }));
    expect(out.impacts).toEqual([]);
    expect(out.paths).toHaveLength(1);
    const path = out.paths[0]!;
    expect(path.launchTick).toBe(0);
    expect(path.pointTicks).toEqual(path.points.map((_, i) => i));
    expect(out.ticks).toBe(path.points.length - 1);
    expect(out.hpAfter).toEqual([100, 100, 100]);
    expect(out.teleport).not.toBeNull();
    expect(out.positions).toEqual([{ x: 60, y: 150 }, { x: 72, y: 150 }, out.teleport]);
  });

  it("アイテムを使わなければ今の同時処理と同じ結果になる", () => {
    for (const weapon of ["cannon", "multiple", "drill"] as const) {
      const input = shot({ weapon });
      expect(simulateConcurrentCombatWithItem(flatMask(), players, 0, input)).toEqual(simulateConcurrentCombat(flatMask(), players, input));
    }
  });
});
