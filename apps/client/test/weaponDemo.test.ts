import { WEAPON_IDS, type WeaponId } from "@game/protocol";
import { describe, expect, it } from "vitest";
import { CARVE_AT_MS, HOLD_MS, IMPACT_TOTAL_MS } from "@/game/hitFeedback";
import { FIELD_COLS_MIN, GROUND_ROWS, bulletTimeAt, debrisCount, demoFrame, demoShots, fieldFor, prepareDemo } from "@/screens/weaponDemo";

// 設定画面の武器デモの弾道と着弾の演出。見た目だけだが、全武器が切れ端の中に落ちて終わることと、
// 着弾の演出が対戦の再生と同じ時間割で出ることを固定する。

const first = <T,>(items: readonly T[]): T => {
  const v = items[0];
  if (v === undefined) throw new Error("empty");
  return v;
};
const last = <T,>(items: readonly T[]): T => first([...items].reverse());

/** 基準表示（1792 × 900、セル 3 px、ペイン幅の半分）に近い幅 */
const FIELD = fieldFor(260);
const frameOf = (w: WeaponId, t: number, field = FIELD) => demoFrame(prepareDemo(w, field), t);
const firstShot = (w: WeaponId, field = FIELD) => first(demoShots(w, field));
/** 1 発目の最初の着弾の時刻 */
const landAt = (w: WeaponId) => first(firstShot(w).stages).at;

describe("fieldFor", () => {
  it("下限より狭い幅は下限に丸める", () => {
    expect(fieldFor(10).cols).toBe(FIELD_COLS_MIN);
    expect(fieldFor(160.7).cols).toBe(160);
  });

  it("地面の上に戦車が載り、主砲の先端は戦車の右上にある", () => {
    expect(FIELD.ground).toBe(FIELD.rows - GROUND_ROWS);
    expect(FIELD.tank.y + 5).toBe(FIELD.ground);
    expect(FIELD.muzzle.x).toBeGreaterThan(FIELD.tank.x + 7);
    expect(FIELD.muzzle.y).toBeLessThan(FIELD.tank.y);
  });
});

describe("demoShots", () => {
  it("扇と時間差の発を掛けた数の弾道になる", () => {
    expect(demoShots("cannon", FIELD)).toHaveLength(1);
    expect(demoShots("triple", FIELD)).toHaveLength(3);
    expect(demoShots("multiple", FIELD)).toHaveLength(9);
  });

  it("扇の 2 本目以降と、時間差の次の発は遅れて出る", () => {
    const [d0, d1, d2, d3] = demoShots("multiple", FIELD).map((s) => s.delay);
    expect(d0).toBe(0);
    expect(d1 ?? 0).toBeGreaterThan(d0 ?? 0);
    expect(d3 ?? 0).toBeGreaterThan(d2 ?? 0);
  });

  it("着弾の段は武器の段数で、貫通弾は 3 段、レーザー弾は 5 段が前の段より深く進む", () => {
    expect(firstShot("cannon").stages).toHaveLength(1);
    const drill = firstShot("drill").stages;
    expect(drill).toHaveLength(3);
    expect(firstShot("laser").stages).toHaveLength(5);
    for (let k = 1; k < drill.length; k++) {
      const prev = drill[k - 1];
      const cur = drill[k];
      if (!prev || !cur) throw new Error("stage");
      expect(cur.y).toBeGreaterThan(prev.y);
      // 前の段で HOLD_MS だけ止まるので、発射からの時刻はその分ずれる
      expect(cur.at - cur.flightAt).toBeCloseTo((k * HOLD_MS) / 1000);
      expect(cur.radius).toBeLessThan(prev.radius);
    }
  });

  it("マルチ弾の 2 発目以降は前の発の穴の奥に落ち、同じ線の 3 発は後ほど深い", () => {
    const shots = demoShots("multiple", FIELD);
    for (const fan of [0, 1, 2]) {
      const ys = [0, 1, 2].map((volley) => first(shots[volley * 3 + fan]?.stages ?? []).y);
      expect(ys[1] ?? 0).toBeGreaterThan(ys[0] ?? 0);
      expect(ys[2] ?? 0).toBeGreaterThan(ys[1] ?? 0);
    }
  });

  it("全武器の全弾が 3 秒以内に、右端より手前の地面か穴に落ちる", () => {
    for (const cols of [FIELD_COLS_MIN, 160, 260, 400]) {
      const field = fieldFor(cols);
      for (const w of WEAPON_IDS) {
        for (const s of demoShots(w, field)) {
          const hit = first(s.stages);
          expect(hit.at).toBeLessThan(3);
          expect(hit.x).toBeLessThan(field.cols);
          expect(hit.y).toBeGreaterThanOrEqual(field.ground - 1);
          expect(hit.y).toBeLessThan(field.rows);
        }
      }
    }
  });

  it("浮遊弾は標準砲より長く飛び、針弾は遠くに落ちる", () => {
    expect(landAt("floater")).toBeGreaterThan(landAt("cannon"));
    expect(first(firstShot("stinger").stages).x).toBeGreaterThan(first(firstShot("cannon").stages).x);
  });
});

describe("bulletTimeAt", () => {
  it("着弾の瞬間から HOLD_MS は着弾点で止まり、続きの段へ飛び、最後の段の後は消える", () => {
    const shot = firstShot("drill");
    const [s0, s1] = shot.stages;
    if (!s0 || !s1) throw new Error("stage");
    expect(bulletTimeAt(shot, s0.at - 0.01)?.holding).toBe(false);
    expect(bulletTimeAt(shot, s0.at + 0.01)).toEqual({ flightAt: s0.flightAt, holding: true });
    const between = bulletTimeAt(shot, (s0.at + HOLD_MS / 1000 + s1.at) / 2);
    expect(between?.holding).toBe(false);
    expect(between?.flightAt ?? 0).toBeGreaterThan(s0.flightAt);
    expect(bulletTimeAt(shot, last(shot.stages).at + HOLD_MS / 1000 + 0.01)).toBeNull();
  });
});

describe("demoFrame", () => {
  it("発射直後は主砲の先端に 1 発があり、爆風も削りも無い", () => {
    const f = frameOf("cannon", 0);
    expect(f.bullets).toHaveLength(1);
    expect(first(f.bullets).x).toBeCloseTo(FIELD.muzzle.x);
    expect(first(f.bullets).y).toBeCloseTo(FIELD.muzzle.y);
    expect(f.blasts).toHaveLength(0);
    expect(f.craters).toHaveLength(0);
    expect(f.done).toBe(false);
  });

  it("弾は進む向きを持つ。発射直後は 45 度で右上、頂点を過ぎると右下を向く", () => {
    const launch = first(frameOf("laser", 0).bullets);
    expect(launch.angle).toBeCloseTo(-Math.PI / 4);
    expect(first(frameOf("laser", 0.01).bullets).angle).toBeGreaterThan(launch.angle);
    // 発射から 1 秒。頂点（初速 sin45 / 重力の 70% で 1 秒より手前）を過ぎている
    expect(first(frameOf("laser", 1).bullets).angle).toBeGreaterThan(0);
  });

  it("飛んでいる間の弾は切れ端の中にある", () => {
    for (const w of WEAPON_IDS) {
      for (let t = 0; t < 3; t += 0.05) {
        for (const b of frameOf(w, t).bullets) {
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.x).toBeLessThan(FIELD.cols);
          expect(b.y).toBeGreaterThanOrEqual(0);
          expect(b.y).toBeLessThan(FIELD.rows);
        }
      }
    }
  });

  it("着弾の演出は対戦と同じ時間割で、静止、膨張、削り、輪の順に進む", () => {
    const at = landAt("cannon");
    const hold = frameOf("cannon", at + 0.03);
    expect(hold.blasts).toHaveLength(0);
    expect(hold.bullets).toHaveLength(1);
    const expanding = frameOf("cannon", at + (HOLD_MS + 60) / 1000);
    expect(first(expanding.blasts).radius).toBeGreaterThan(2);
    expect(first(expanding.blasts).radius).toBeLessThan(10);
    expect(expanding.craters).toHaveLength(0);
    const carved = frameOf("cannon", at + (CARVE_AT_MS + 10) / 1000);
    expect(first(carved.craters).radius).toBe(10);
    expect(carved.debris).toHaveLength(debrisCount(10));
    const ring = frameOf("cannon", at + (IMPACT_TOTAL_MS - 50) / 1000);
    expect(first(ring.blasts).ring).toBe(true);
    expect(frameOf("cannon", at + IMPACT_TOTAL_MS / 1000 + 0.01).blasts).toHaveLength(0);
  });

  it("掘削弾の爆風と穴は針弾より大きく、破片も多い", () => {
    const craterOf = (w: WeaponId) => first(frameOf(w, landAt(w) + (CARVE_AT_MS + 10) / 1000).craters);
    expect(craterOf("digger").radius).toBeGreaterThan(craterOf("stinger").radius);
    expect(debrisCount(craterOf("digger").radius)).toBeGreaterThan(debrisCount(craterOf("stinger").radius));
  });

  it("貫通弾は段ごとに穴が積み上がる", () => {
    const shot = firstShot("drill");
    const done = frameOf("drill", last(shot.stages).at + IMPACT_TOTAL_MS / 1000);
    expect(done.craters).toHaveLength(3);
    expect(done.bullets).toHaveLength(0);
  });

  it("全武器が 4 秒で終わる", () => {
    for (const w of WEAPON_IDS) expect(frameOf(w, 4).done).toBe(true);
  });
});
