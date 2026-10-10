import type { ShotResult, WeaponId } from "@game/protocol";
import { describe, expect, it } from "vitest";
import { CLIMB_MAX, damageDealtTo, firstStage, fullHitDamage, STEPS_PER_TURN, walk, weaponSpec, type ShotOutcome, type TankPos, type TerrainMask } from "../src/index.js";
import { fire, flatMask, shot, type Standing } from "./helpers.js";

// 機体の芯（設計書 01 の 1.7、02 の 2.3）。弾は芯にだけ当たり、芯を外れた弾は車体を素通りして足元の地面を削る。

const GROUND = 150;
const TARGET = 200;
const players: readonly [Standing, Standing] = [{ x: 100, hp: 100 }, { x: TARGET, hp: 100 }];

/** 仰角の高い順に探し、最初の着弾が列 x に来る射撃。急な角度で落ちる弾から選ぶ */
const shotLandingAt = (weapon: WeaponId, x: number): ShotOutcome => {
  const mask = flatMask(GROUND);
  for (let elevation = 85; elevation >= 30; elevation--) {
    for (let power = 1; power <= 100; power++) {
      const out = fire(mask, players, shot({ weapon, x: 100, elevation, power }));
      if (out.result.impacts[0]?.cell.x === x) return out;
    }
  }
  throw new Error(`${weapon} の着弾が ${x} に来る射撃がない`);
};

const fallOf = (r: ShotResult): number => r.yAfter[1] - GROUND;

describe("機体の芯", () => {
  it("芯に当たった弾は機体で止まり、最大ダメージが出る", () => {
    const r = shotLandingAt("cannon", TARGET).result;
    expect(r.impacts[0]!.cell.y).toBeLessThan(GROUND);
    expect(damageDealtTo(r, 1)).toBe(firstStage("cannon").damageMax);
  });

  it("芯から 2 列ずれた弾は車体を素通りして足元の地面に当たり、最大ダメージは出ない", () => {
    for (const x of [TARGET - 2, TARGET + 2]) {
      const r = shotLandingAt("cannon", x).result;
      expect(r.impacts[0]!.cell.y).toBeGreaterThanOrEqual(GROUND);
      expect(damageDealtTo(r, 1)).toBeLessThan(firstStage("cannon").damageMax);
      expect(damageDealtTo(r, 1)).toBeGreaterThan(0);
    }
  });

  it("芯に当てたレーザー弾は全段が機体に入る", () => {
    const r = shotLandingAt("laser", TARGET).result;
    expect(damageDealtTo(r, 1)).toBe(fullHitDamage(weaponSpec("laser")));
  });

  it("足元に急角度で落としたレーザー弾は真下を掘り抜き、機体を 15 セル以上落とすが、ダメージは入らない", () => {
    for (const x of [TARGET - 2, TARGET + 2]) {
      const r = shotLandingAt("laser", x).result;
      expect(r.ringOut).toEqual([]);
      expect(fallOf(r)).toBeGreaterThanOrEqual(15);
      expect(damageDealtTo(r, 1)).toBe(0);
    }
  });

  it("レーザー弾は中心から 3 列ずれた足元に落としても、機体を落とす", () => {
    for (const x of [TARGET - 3, TARGET + 3]) {
      const r = shotLandingAt("laser", x).result;
      expect(fallOf(r)).toBeGreaterThanOrEqual(15);
    }
  });

  it("足元に落とした貫通弾も機体を落とす", () => {
    const r = shotLandingAt("drill", TARGET + 2).result;
    expect(fallOf(r)).toBeGreaterThanOrEqual(10);
  });

  it("レーザー弾で落とされた穴からは、左右どちらへ何ターン歩いても元の地表へ戻れない", () => {
    /** 同じ向きへ 3 ターン歩いた位置 */
    const walkTurns = (mask: TerrainMask, from: TankPos, dir: -1 | 1): TankPos =>
      [0, 1, 2].reduce((pos) => walk(mask, pos, dir, STEPS_PER_TURN), from);
    for (const x of [TARGET - 2, TARGET + 2]) {
      const out = shotLandingAt("laser", x);
      const pos = { x: out.result.xAfter[1], y: out.result.yAfter[1] };
      for (const dir of [-1, 1] as const) {
        expect(walkTurns(out.mask, pos, dir).y).toBeGreaterThan(GROUND + CLIMB_MAX);
      }
    }
  });
});
