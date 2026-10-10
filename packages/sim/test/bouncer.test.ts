import type { TrajectoryInput } from "@game/protocol";
import { describe, expect, it } from "vitest";
import { damageDealtTo, fullHitDamage, maskFromHeights, MAP_HEIGHT, MAP_WIDTH, simulateShot, spawnPos, weaponSpec, type TerrainMask } from "../src/index.js";
import { fire, flatMask, shot, wallMask, type Standing } from "./helpers.js";

// 跳ね弾（設計書 10.2）。最初に地形へ当たると小さく爆発して 1 回だけ跳ね返り、次の接触でもう一度爆発する。
// 機体の芯に当たれば跳ねずに、2 段とも同じ場所で爆発する。

const far: readonly [Standing, Standing] = [{ x: 60, hp: 100 }, { x: 390, hp: 100 }];

const both = (mask: TerrainMask, input: Partial<TrajectoryInput>, players = far) => ({
  cannon: fire(mask, players, shot({ ...input, weapon: "cannon" })),
  bouncer: fire(mask, players, shot({ ...input, weapon: "bouncer" })),
});

describe("跳ね弾", () => {
  it("最初の接触で爆発して 1 回跳ね、次の接触でもう一度爆発する", () => {
    const spec = weaponSpec("bouncer");
    expect(spec.stages).toHaveLength(2);
    expect(spec.bounce).toEqual({ keepPercent: 50 });
    const { cannon, bouncer } = both(flatMask(150), { x: 60, elevation: 45, power: 50 });
    const [first, second] = bouncer.result.impacts;
    expect(bouncer.result.impacts).toHaveLength(2);
    // 1 回目の爆発は、同じ照準の標準砲の着弾と同じ所
    expect(first!.cell).toEqual(cannon.result.impacts[0]!.cell);
    expect(first!.terrainOp.radius).toBeLessThan(second!.terrainOp.radius);
  });

  it("床で跳ねると上へ返り、1 回目の爆発より先で 2 回目が爆発する", () => {
    const { bouncer } = both(flatMask(150), { x: 60, elevation: 45, power: 50 });
    const [first, second] = bouncer.result.impacts;
    expect(second!.cell.x).toBeGreaterThan(first!.cell.x);
    // 1 回目の着弾の点から、次の点は上へ飛ぶ
    const path = bouncer.paths[0]!;
    const at = path.impactAt[0]!;
    expect(path.points[at + 1]!.y).toBeLessThan(path.points[at]!.y);
  });

  it("跳ねは小さく、2 回目は最初の飛距離の半分より手前で、1 回目の爆風の外で爆発する", () => {
    const [stage1] = weaponSpec("bouncer").stages;
    for (const [elevation, power] of [[10, 40], [45, 50], [60, 70], [20, 100]] as const) {
      const { bouncer } = both(flatMask(150), { x: 60, elevation, power });
      const [first, second] = bouncer.result.impacts;
      const hop = second!.cell.x - first!.cell.x;
      expect(hop, `${elevation}/${power}`).toBeLessThan((first!.cell.x - 60) / 2);
      expect(hop, `${elevation}/${power}`).toBeGreaterThan(stage1!.blastRadius);
    }
  });

  it("壁で跳ねると向きが反転し、2 回目は壁の手前で爆発する", () => {
    const { cannon, bouncer } = both(wallMask(150, 60), { x: 60, elevation: 20, power: 80 });
    expect(cannon.result.impacts[0]!.cell.x).toBe(150);
    expect(bouncer.result.impacts[0]!.cell.x).toBe(150);
    expect(bouncer.result.impacts[1]!.cell.x).toBeLessThan(150);
  });

  it("天井で跳ねると下へ返り、2 回目は床で爆発する", () => {
    // 地表の 23 セル上に厚い天井が全面に張る洞窟。機体は天井の下の床に立つ
    const cells = new Uint8Array(flatMask(150).cells);
    for (let y = 120; y < 128; y++) for (let x = 0; x < MAP_WIDTH; x++) cells[y * MAP_WIDTH + x] = 1;
    const cave: TerrainMask = { width: MAP_WIDTH, height: MAP_HEIGHT, cells };
    const under = (x: number) => ({ ...spawnPos(cave, x, 130), hp: 100 });
    const cast = (weapon: "cannon" | "bouncer") => simulateShot(cave, [under(60), under(390)], shot({ weapon, x: 60, elevation: 70, power: 40 }));
    expect(cast("cannon").result.impacts[0]!.cell.y).toBe(127);
    const [first, second] = cast("bouncer").result.impacts;
    expect(first!.cell.y).toBe(127);
    expect(second!.cell.y).toBeGreaterThan(140);
  });

  it("機体の芯に当たれば跳ねずに、2 段とも同じ場所で爆発する", () => {
    const near: readonly [Standing, Standing] = [{ x: 60, hp: 100 }, { x: 72, hp: 100 }];
    const out = fire(flatMask(150), near, shot({ weapon: "bouncer", elevation: 10, power: 20 }));
    expect(new Set(out.result.impacts.map((i) => `${i.cell.x},${i.cell.y}`)).size).toBe(1);
    expect(damageDealtTo(out.result, 1)).toBe(fullHitDamage(weaponSpec("bouncer")));
  });

  it("同じ入力からは同じ跳ね方になる", () => {
    const mask = maskFromHeights(Array.from({ length: MAP_WIDTH }, (_, x) => 150 - (x % 37 < 6 ? 3 : 0)), MAP_HEIGHT);
    const a = fire(mask, far, shot({ weapon: "bouncer", elevation: 35, power: 70, wind: -4 }));
    const b = fire(mask, far, shot({ weapon: "bouncer", elevation: 35, power: 70, wind: -4 }));
    expect(b.result).toEqual(a.result);
    expect(b.paths).toEqual(a.paths);
  });
});
