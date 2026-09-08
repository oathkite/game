import type { ShotResult, WeaponId } from "@game/protocol";
import { describe, expect, it } from "vitest";
import {
  BLAST_RADIUS,
  DAMAGE_MAX,
  DAMAGE_PER_CELL,
  damageAt,
  damageDealtTo,
  firstStage,
  flatMask,
  fullHitDamage,
  HP_MAX,
  ONE,
  projectileCount,
  shot,
  simulateShot,
  WEAPON_SPECS,
  weaponSpec,
} from "../src/index.js";

// 武器の手触りを数値で固定する。設計書 10 の 10.2 と 10.3。
// 数値そのものではなく「どちらが遠くへ飛ぶか」「どちらが風に流されるか」という関係を固定し、調整の余地を残す。

const WEAPONS = Object.keys(WEAPON_SPECS) as WeaponId[];
/** 弾道が 1 本で着弾が 1 段の武器。到達距離や風のずれを 1 つの値として比べられる */
const SINGLE = WEAPONS.filter((w) => projectileCount(weaponSpec(w)) === 1 && weaponSpec(w).stages.length === 1);

type Flight = { readonly range: number; readonly apex: number; readonly steps: number };

/** 平地の左端から仰角 45 度で撃ったときの最初の弾道の到達距離、最高点の高さ、飛行ステップ数 */
const flight = (weapon: WeaponId, power: number, wind: number): Flight => {
  const surface = 200;
  const out = simulateShot(flatMask(surface), [{ x: 20, hp: 100 }, { x: 399, hp: 100 }], shot({ weapon, x: 20, elevation: 45, power, wind }));
  const impactX = out.result.impacts[0]?.cell.x ?? 399;
  const points = out.paths[0]?.points ?? [];
  const apex = surface - Math.min(...points.map((p) => p.y)) / ONE;
  return { range: impactX - 20, apex, steps: points.length };
};

const drift = (weapon: WeaponId, power: number): number => flight(weapon, power, 10).range - flight(weapon, power, 0).range;

const dealtTo = damageDealtTo;

/** 平地で相手を至近（12 セル）に置き、低い仰角で直撃させる。標準砲なら 35 が出る */
const pointBlank = (weapon: WeaponId): ShotResult => simulateShot(flatMask(150), [{ x: 60, hp: 100 }, { x: 72, hp: 100 }], shot({ weapon, elevation: 10, power: 40 })).result;

/** 平地を仰角 30 度で撃つ。扇と貫通の着弾の並びを見る */
const spread = (weapon: WeaponId, power = 60): ShotResult => simulateShot(flatMask(200), [{ x: 20, hp: 100 }, { x: 399, hp: 100 }], shot({ weapon, x: 20, elevation: 30, power })).result;

describe("武器の数値", () => {
  it("標準砲は設計書 01 と 06 の初期値そのままで、1 発 1 段、倍率はすべて 100%", () => {
    expect(weaponSpec("cannon")).toEqual({
      fan: [{ deg: 0, speedPercent: 100 }],
      volleys: 1,
      stages: [{ blastRadius: BLAST_RADIUS, damageMax: DAMAGE_MAX, damagePerCell: DAMAGE_PER_CELL }],
      speedPercent: 100,
      gravityPercent: 100,
      windPercent: 100,
    });
  });

  it("どの武器も全弾全段の直撃でも 1 発では沈まず、3 発以内で沈む", () => {
    for (const w of WEAPONS) {
      expect(fullHitDamage(weaponSpec(w)), w).toBeLessThan(HP_MAX);
      expect(fullHitDamage(weaponSpec(w)) * 3, w).toBeGreaterThan(0);
    }
    // 掘削弾だけは「これだけでは沈められない」武器なので除く
    for (const w of WEAPONS.filter((w) => w !== "digger")) expect(fullHitDamage(weaponSpec(w)) * 3, w).toBeGreaterThanOrEqual(HP_MAX * 0.7);
  });

  it("爆風の端のダメージは 0 以上で、爆風の外は 0（すべての段）", () => {
    const center = { x: 100, y: 147 };
    for (const w of WEAPONS) {
      for (const stage of weaponSpec(w).stages) {
        const edge = stage.blastRadius + 3;
        expect(damageAt({ x: 100 + edge, y: 147 }, center, stage), w).toBeGreaterThanOrEqual(0);
        expect(damageAt({ x: 100 + edge + 1, y: 147 }, center, stage), w).toBe(0);
      }
    }
  });

  it("全弾直撃の合計は レーザー > 針弾 > トリプル = マルチ > 貫通 > 標準砲 > 浮遊弾 > 掘削弾", () => {
    const full = (w: WeaponId) => fullHitDamage(weaponSpec(w));
    expect(full("laser")).toBeGreaterThan(full("stinger"));
    expect(full("stinger")).toBeGreaterThan(full("triple"));
    expect(full("triple")).toBe(full("multiple"));
    expect(full("multiple")).toBeGreaterThan(full("drill"));
    expect(full("drill")).toBeGreaterThan(full("cannon"));
    expect(full("cannon")).toBeGreaterThan(full("floater"));
    expect(full("floater")).toBeGreaterThan(full("digger"));
  });

  it("浮遊弾は最も当てにくいぶん、直撃は標準砲の 8 割以上で爆風は標準砲と同じ", () => {
    expect(firstStage("floater").damageMax).toBeGreaterThanOrEqual(firstStage("cannon").damageMax * 0.8);
    expect(firstStage("floater").blastRadius).toBe(firstStage("cannon").blastRadius);
  });

  it("弾数が多い武器は 1 発が小さく、爆風も狭い", () => {
    expect(firstStage("triple").damageMax).toBeLessThan(firstStage("cannon").damageMax / 2);
    expect(firstStage("multiple").damageMax).toBeLessThan(firstStage("triple").damageMax / 2);
    expect(firstStage("triple").blastRadius).toBeLessThan(firstStage("cannon").blastRadius);
    expect(firstStage("multiple").blastRadius).toBeLessThan(firstStage("triple").blastRadius);
  });
});

describe("扇に広がる武器", () => {
  it("トリプル弾は低い仰角では 1 発目が遠く、2 発目が中央、3 発目が手前に、前後へ広がる", () => {
    const r = spread("triple");
    expect(r.impacts.map((i) => i.projectile)).toEqual([0, 1, 2]);
    expect(r.impacts.every((i) => i.stage === 0)).toBe(true);
    const xs = r.impacts.map((i) => i.cell.x);
    expect(xs[0]).toBeGreaterThan(xs[1]!);
    expect(xs[1]).toBeGreaterThan(xs[2]!);
    // 中央の射程の 1 割以上は離れる。狭いと扇に見えない
    const center = xs[1]! - 20;
    expect(xs[0]! - xs[1]!).toBeGreaterThan(center * 0.1);
    expect(xs[1]! - xs[2]!).toBeGreaterThan(center * 0.1);
  });

  it("トリプル弾は仰角 60 度前後（背面打ちの実効角度）で 3 発が数セル以内に集まる", () => {
    const at = (elevation: number) => simulateShot(flatMask(200), [{ x: 20, hp: 100 }, { x: 399, hp: 100 }], shot({ weapon: "triple", x: 20, elevation, power: 60 })).result;
    const width = (elevation: number) => {
      const xs = at(elevation).impacts.map((i) => i.cell.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(width(60)).toBeLessThanOrEqual(6);
    // 低い角度では広がり、集まるのは高い角度だけ
    expect(width(30)).toBeGreaterThan(width(60) * 3);
  });

  it("扇のずれは撃つ側の向きに合わせて鏡像になり、左向きでも 1 発目が遠い", () => {
    const r = simulateShot(flatMask(200), [{ x: 379, hp: 100 }, { x: 0, hp: 100 }], shot({ weapon: "triple", x: 379, facing: -1, elevation: 30, power: 60 })).result;
    const ranges = r.impacts.map((i) => 379 - i.cell.x);
    expect(ranges[0]).toBeGreaterThan(ranges[1]!);
    expect(ranges[1]).toBeGreaterThan(ranges[2]!);
    expect(ranges).toEqual(spread("triple").impacts.map((i) => i.cell.x - 20));
  });

  it("トリプル弾は至近なら複数の弾が直撃し、合計で標準砲の直撃を上回れる", () => {
    const r = pointBlank("triple");
    const hits = r.impacts.filter((i) => i.damage[1] === firstStage("triple").damageMax);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(dealtTo(r, 1)).toBeGreaterThan(firstStage("cannon").damageMax * 0.8);
  });

  it("マルチ弾は 9 発で、同じ角度の 3 発は同じ線を辿って数セル以内に落ちる", () => {
    const r = spread("multiple");
    expect(r.impacts).toHaveLength(9);
    expect(r.impacts.map((i) => i.projectile)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (const fan of [0, 1, 2]) {
      const line = [0, 1, 2].map((volley) => r.impacts[volley * 3 + fan]!.cell.x);
      expect(Math.max(...line) - Math.min(...line), `fan ${fan}`).toBeLessThanOrEqual(6);
    }
  });

  it("マルチ弾の削る半径はトリプル弾より小さい", () => {
    expect(firstStage("multiple").blastRadius).toBeLessThan(firstStage("triple").blastRadius);
  });
});

describe("貫通する武器", () => {
  it("貫通弾は地形に当たっても止まらず 3 段掘り進み、段ごとに半径とダメージが小さくなる", () => {
    const stages = weaponSpec("drill").stages;
    expect(stages).toHaveLength(3);
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i]!.blastRadius).toBeLessThan(stages[i - 1]!.blastRadius);
      expect(stages[i]!.damageMax).toBeLessThan(stages[i - 1]!.damageMax);
    }
    const r = spread("drill");
    expect(r.impacts.map((i) => i.stage)).toEqual([0, 1, 2]);
    expect(r.impacts.every((i) => i.projectile === 0)).toBe(true);
    // 後の段ほど深い
    expect(r.impacts[1]!.cell.y).toBeGreaterThan(r.impacts[0]!.cell.y);
    expect(r.impacts[2]!.cell.y).toBeGreaterThan(r.impacts[1]!.cell.y);
  });

  it("機体に当たった貫通弾は食い込み、全段が同じセルで機体に入る", () => {
    const r = pointBlank("drill");
    expect(r.impacts).toHaveLength(3);
    expect(new Set(r.impacts.map((i) => `${i.cell.x},${i.cell.y}`)).size).toBe(1);
    expect(dealtTo(r, 1)).toBe(fullHitDamage(weaponSpec("drill")));
  });

  it("レーザー弾は 7 段が同じ数値で、地形では線のように並んで削る", () => {
    const stages = weaponSpec("laser").stages;
    expect(stages).toHaveLength(7);
    expect(new Set(stages.map((s) => JSON.stringify(s))).size).toBe(1);
    const r = spread("laser");
    expect(r.impacts).toHaveLength(7);
    // 隣の段との距離は爆風半径の 2 倍以内。離れていると線に見えない
    for (let i = 1; i < r.impacts.length; i++) {
      const a = r.impacts[i - 1]!.cell;
      const b = r.impacts[i]!.cell;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeLessThanOrEqual(stages[0]!.blastRadius * 2);
    }
    expect(dealtTo(pointBlank("laser"), 1)).toBe(fullHitDamage(weaponSpec("laser")));
  });

  it("レーザー弾は標準砲より伸びるが 1.5 倍までで、風には標準砲以上に流される", () => {
    const c = flight("cannon", 40, 0);
    const l = flight("laser", 40, 0);
    expect(l.range / c.range).toBeGreaterThan(1.1);
    expect(l.range / c.range).toBeLessThan(1.5);
    expect(weaponSpec("laser").windPercent).toBe(100);
    expect(drift("laser", 40)).toBeGreaterThanOrEqual(drift("cannon", 40));
  });
});

describe("1 発 1 段の武器の性格", () => {
  it("掘削弾は爆風が最も広く、直撃でも標準砲のかすり程度しか効かない", () => {
    const digger = firstStage("digger");
    for (const w of WEAPONS) if (w !== "digger") expect(digger.blastRadius).toBeGreaterThan(firstStage(w).blastRadius);
    expect(digger.damageMax).toBeLessThanOrEqual(DAMAGE_MAX - DAMAGE_PER_CELL * 6);
  });

  it("浮遊弾は標準砲と同じくらいの距離と高さを、3 割以上長い時間をかけて飛び、風 10 のずれは 3 倍以上", () => {
    const c = flight("cannon", 60, 0);
    const f = flight("floater", 60, 0);
    expect(f.range / c.range).toBeGreaterThan(0.85);
    expect(f.range / c.range).toBeLessThan(1.15);
    expect(f.apex / c.apex).toBeGreaterThan(0.85);
    expect(f.apex / c.apex).toBeLessThan(1.15);
    expect(f.steps).toBeGreaterThan(c.steps * 1.3);
    expect(drift("floater", 60)).toBeGreaterThanOrEqual(drift("cannon", 60) * 3);
  });

  it("針弾は直撃なら全武器で最大、着弾距離 3 セルで 1 割、4 セル以上は 0", () => {
    const stinger = firstStage("stinger");
    for (const w of WEAPONS) if (w !== "stinger") expect(stinger.damageMax).toBeGreaterThan(firstStage(w).damageMax);
    const center = { x: 100, y: 147 };
    expect(damageAt({ x: 100, y: 144 }, center, stinger)).toBe(stinger.damageMax);
    expect(damageAt({ x: 106, y: 147 }, center, stinger)).toBe(10);
    expect(damageAt({ x: 107, y: 147 }, center, stinger)).toBe(0);
  });

  it("1 発 1 段の武器は 4 つ", () => {
    expect(SINGLE.sort()).toEqual(["cannon", "digger", "floater", "stinger"].sort());
  });
});
