import type { ShotResult } from "@game/protocol";
import { describe, expect, it } from "vitest";
import {
  BLAST_RADIUS,
  damageAt,
  fireAngle,
  isSolid,
  MAP_HEIGHT,
  MAX_STEPS,
  maskFromHeights,
  muzzleOf,
  ONE,
  simulateShot,
  surfaceY,
  TANK_RADIUS,
  tankCenterY,
  type Combatant,
} from "../src/index.js";
import { flatMask, islandMask, mirrorMask, mirrorX, shot, slabMask, slopedMask, valleyMask, wallMask } from "./helpers.js";

const two = (x0: number, x1: number, hp0 = 100, hp1 = 100): readonly [Combatant, Combatant] => [
  { x: x0, hp: hp0 },
  { x: x1, hp: hp1 },
];

describe("発射角と発射位置", () => {
  it("右向きは 傾き + 仰角、左向きは 180 + 傾き − 仰角", () => {
    expect(fireAngle(0, 45, 1)).toBe(45);
    expect(fireAngle(10, 45, 1)).toBe(55);
    expect(fireAngle(0, 45, -1)).toBe(135);
    expect(fireAngle(10, 45, -1)).toBe(145);
    expect(fireAngle(-45, 10, 1)).toBe(-35);
    expect(fireAngle(45, 90, -1)).toBe(135);
  });

  it("平坦なら付け根は接地点の真上 4 セル、先端は仰角の方向に 4 セル", () => {
    const mask = flatMask(150);
    const m = muzzleOf(mask, 100, 1, 90);
    expect(m.angle).toBe(90);
    expect(m.position.x).toBe(100 * ONE + ONE / 2);
    expect(m.position.y).toBe((150 - 8) * ONE);
  });

  it("上り坂に向くと発射角が上がり、発射位置は判定円の外に出る", () => {
    const mask = slopedMask(6);
    const m = muzzleOf(mask, 100, 1, 30);
    expect(m.angle).toBe(75);
    const cx = 100;
    const cy = tankCenterY(mask, 100);
    const dx = Math.floor(m.position.x / ONE) - cx;
    const dy = Math.floor(m.position.y / ONE) - cy;
    expect(dx * dx + dy * dy).toBeGreaterThan(TANK_RADIUS * TANK_RADIUS);
  });
});

describe("ダメージ", () => {
  it("判定円に触れた直撃は 35、離れるほど 3 ずつ減り、着弾距離 11 以上は 0", () => {
    const center = { x: 100, y: 147 };
    expect(damageAt({ x: 100, y: 144 }, center)).toBe(35);
    expect(damageAt({ x: 100, y: 147 }, center)).toBe(35);
    expect(damageAt({ x: 104, y: 147 }, center)).toBe(32);
    expect(damageAt({ x: 113, y: 147 }, center)).toBe(5);
    expect(damageAt({ x: 114, y: 147 }, center)).toBe(0);
    expect(damageAt({ x: 200, y: 147 }, center)).toBe(0);
  });

  it("距離に対して単調に減る", () => {
    const center = { x: 100, y: 147 };
    let prev = Number.POSITIVE_INFINITY;
    for (let d = 0; d <= 20; d++) {
      const cur = damageAt({ x: 100 + d, y: 147 }, center);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe("1 発の処理", () => {
  it("同じ入力からは同じ結果が出る", () => {
    const mask = valleyMask();
    const a = simulateShot(mask, two(60, 340), shot({ power: 70, wind: -4 }));
    const b = simulateShot(mask, two(60, 340), shot({ power: 70, wind: -4 }));
    expect(a.result).toEqual(b.result);
    expect(a.path).toEqual(b.path);
  });

  it("平地で前方に撃てば地面に当たり、地形が削れる", () => {
    const mask = flatMask(150);
    const out = simulateShot(mask, two(60, 340), shot({ power: 50 }));
    expect(out.result.impact).not.toBeNull();
    const impact = out.result.impact!;
    expect(impact.y).toBe(150);
    expect(impact.x).toBeGreaterThan(60);
    expect(out.result.terrainOp).toEqual({ cx: impact.x, cy: impact.y, radius: BLAST_RADIUS });
    expect(isSolid(out.mask, impact.x, impact.y)).toBe(false);
    expect(surfaceY(out.mask, impact.x)).toBe(150 + BLAST_RADIUS + 1);
    expect(out.result.ringOut).toEqual([]);
    expect(out.result.finished).toBeNull();
  });

  it("風は着弾を横にずらす", () => {
    const mask = flatMask(150);
    const calm = simulateShot(mask, two(60, 340), shot({ power: 60, wind: 0 })).result.impact!;
    const tail = simulateShot(mask, two(60, 340), shot({ power: 60, wind: 10 })).result.impact!;
    const head = simulateShot(mask, two(60, 340), shot({ power: 60, wind: -10 })).result.impact!;
    expect(tail.x).toBeGreaterThan(calm.x);
    expect(head.x).toBeLessThan(calm.x);
  });

  it("相手に直撃すれば 35 ダメージで直撃と判定できる", () => {
    const mask = flatMask(150);
    // 相手を近くに置き、低い仰角で撃つ
    const out = simulateShot(mask, two(60, 72), shot({ elevation: 10, power: 40 }));
    expect(out.result.damage[1]).toBe(35);
    expect(out.result.hpAfter[1]).toBe(65);
    expect(out.result.finished).toBeNull();
  });

  it("HP が 0 以下になれば決着し、理由は hp", () => {
    const mask = flatMask(150);
    const out = simulateShot(mask, two(60, 72, 100, 20), shot({ elevation: 10, power: 40 }));
    expect(out.result.hpAfter[1]).toBeLessThanOrEqual(0);
    expect(out.result.finished).toEqual({ winner: 0, reason: "hp" });
  });

  it("足元を削られて地面がなくなればリングアウト", () => {
    // 薄い板の島。自機は広い島、相手は幅 3 セルの島に立つ。至近で直撃させ、爆風で島ごと消す
    const mask = slabMask([[150, 190], [199, 201]], 150, 3);
    const out = simulateShot(mask, two(187, 200), shot({ x: 187, elevation: 10, power: 40 }));
    expect(out.result.impact).not.toBeNull();
    expect(out.result.damage[1]).toBe(35);
    expect(surfaceY(out.mask, 200)).toBe(MAP_HEIGHT);
    expect(out.result.ringOut).toEqual([1]);
    expect(out.result.finished).toEqual({ winner: 0, reason: "ringOut" });
    expect(out.result.xAfter).toEqual([187, 200]);
  });

  it("両者が同時に落ちたら HP の多い側が勝ち、同じなら引き分け", () => {
    // 幅 3 の島が 2 つ隣り合い、両者とも爆風の中に入る
    const mask = slabMask([[195, 197], [203, 205]], 150, 3);
    const draw = simulateShot(mask, two(196, 204, 100, 100), shot({ x: 196, elevation: 10, power: 20 }));
    expect(draw.result.ringOut).toEqual([0, 1]);
    expect(draw.result.finished?.reason).toBe("ringOut");
    expect(draw.result.finished?.winner).toBe(draw.result.hpAfter[0] === draw.result.hpAfter[1] ? null : draw.result.hpAfter[0] > draw.result.hpAfter[1] ? 0 : 1);
    const uneven = simulateShot(mask, two(196, 204, 100, 40), shot({ x: 196, elevation: 10, power: 20 }));
    expect(uneven.result.ringOut).toEqual([0, 1]);
    expect(uneven.result.finished).toEqual({ winner: 0, reason: "ringOut" });
  });

  it("マップの左右や下に出た弾は消え、何も変わらない", () => {
    const mask = islandMask();
    // 奈落に向かって強く撃つ。下端を越えて消える
    const out = simulateShot(mask, two(60, 340), shot({ x: 118, elevation: 10, power: 30 }));
    expect(out.result.impact).toBeNull();
    expect(out.result.terrainOp).toBeNull();
    expect(out.result.damage).toEqual([0, 0]);
    expect(out.mask).toBe(mask);
    const right = simulateShot(flatMask(), two(390, 60), shot({ x: 390, elevation: 10, power: 100 }));
    expect(right.result.impact).toBeNull();
  });

  it("発射位置が地形の中なら、その場で爆発して自機にダメージが入る", () => {
    // 目の前に壁がある。低い仰角で撃つと先端が壁の中に入る
    const mask = wallMask(104, 130);
    const out = simulateShot(mask, two(100, 300), shot({ x: 100, facing: 1, elevation: 10, power: 50 }));
    expect(out.result.impact).not.toBeNull();
    expect(out.result.damage[0]).toBeGreaterThan(0);
    expect(out.path).toHaveLength(1);
  });

  it("真上に撃つと落ちてきて自分の近くに着弾する", () => {
    const out = simulateShot(flatMask(150), two(200, 340), shot({ x: 200, elevation: 90, power: 100 }));
    expect(out.result.impact).not.toBeNull();
    expect(Math.abs(out.result.impact!.x - 200)).toBeLessThanOrEqual(1);
    expect(out.result.damage[0]).toBe(35);
  });

  it("上端を越えた弾は消えず、落ちてきて着弾する", () => {
    // 最大パワーの上昇は約 112 セルで 225 セルのマップの上端には届かないので、背の低いマスクで確かめる
    const small = maskFromHeights(Array.from({ length: 100 }, () => 30), 40);
    const out = simulateShot(small, two(50, 90), shot({ x: 50, elevation: 90, power: 100 }));
    expect(out.path.some((p) => p.y < 0)).toBe(true);
    expect(out.result.impact).not.toBeNull();
    expect(out.result.impact!.y).toBeGreaterThanOrEqual(0);
  });

  it("ステップ数の上限で必ず終わる（範囲外のパワーでも止まる）", () => {
    // 検証前の不正な入力を想定する。真上に極端な初速で撃つと落ちてこない
    const out = simulateShot(flatMask(150), two(200, 340), shot({ x: 200, elevation: 90, power: 100000, wind: 0 }));
    expect(out.result.impact).toBeNull();
    expect(out.path).toHaveLength(MAX_STEPS + 1);
  });

  it("着弾したら path の最後は着弾セルの中心", () => {
    const out = simulateShot(flatMask(150), two(60, 340), shot({ power: 100, elevation: 45 }));
    const last = out.path[out.path.length - 1]!;
    expect(Math.floor(last.x / ONE)).toBe(out.result.impact!.x);
    expect(Math.floor(last.y / ONE)).toBe(out.result.impact!.y);
  });

  it("撃つ側の位置は入力の x を正とし、players の x が古くても発射位置と判定が一致する", () => {
    const mask = flatMask(150);
    const moved = simulateShot(mask, two(60, 340), shot({ x: 75, elevation: 90, power: 100 }));
    expect(moved.result.xAfter).toEqual([75, 340]);
    expect(Math.abs(moved.result.impact!.x - 75)).toBeLessThanOrEqual(1);
    expect(moved.result.damage[0]).toBe(35);
  });

  it("奈落に立つ機体は当たり判定を持たず、外れた弾の経路でもリングアウトになる", () => {
    const mask = islandMask();
    // x=121 は地面がない列。移動の落下でここに来る
    const out = simulateShot(mask, two(121, 340), shot({ x: 121, elevation: 10, power: 30 }));
    expect(out.result.impact).toBeNull();
    expect(out.result.ringOut).toEqual([0]);
    expect(out.result.finished).toEqual({ winner: 1, reason: "ringOut" });
  });

  it("1 セル幅の斜めの壁をすり抜けない", () => {
    const mask = flatMask(150);
    const cells = new Uint8Array(mask.cells);
    for (let k = 0; k <= 40; k++) cells[(100 + k) * mask.width + (80 + k)] = 1;
    const walled = { ...mask, cells };
    const out = simulateShot(walled, two(40, 340), shot({ x: 40, elevation: 24, power: 93 }));
    expect(out.result.impact).not.toBeNull();
    expect(out.result.impact!.x).toBeLessThan(130);
  });
});

describe("鏡像の対称性", () => {
  const mirrorResult = (r: ShotResult, width: number): ShotResult => ({
    ...r,
    input: { ...r.input, x: width - 1 - r.input.x, facing: r.input.facing === 1 ? -1 : 1, wind: -r.input.wind },
    impact: r.impact ? { x: width - 1 - r.impact.x, y: r.impact.y } : null,
    terrainOp: r.terrainOp ? { ...r.terrainOp, cx: width - 1 - r.terrainOp.cx } : null,
    xAfter: [width - 1 - r.xAfter[0], width - 1 - r.xAfter[1]],
  });

  it("地形、位置、向き、風を左右反転すると結果も左右反転する", () => {
    const cases = [
      { mask: valleyMask(), players: two(60, 340), input: shot({ x: 60, facing: 1, elevation: 40, power: 75, wind: 6 }) },
      { mask: slopedMask(4), players: two(120, 300), input: shot({ x: 120, facing: 1, elevation: 25, power: 90, wind: -3 }) },
      { mask: flatMask(), players: two(60, 72), input: shot({ x: 60, facing: 1, elevation: 10, power: 40, wind: 0 }) },
      { mask: valleyMask(), players: two(340, 60, 100, 100), input: shot({ seat: 0, x: 340, facing: -1, elevation: 60, power: 55, wind: -9 }) },
    ];
    for (const c of cases) {
      const a = simulateShot(c.mask, c.players, c.input);
      const m = mirrorMask(c.mask);
      const players: readonly [Combatant, Combatant] = [
        { x: mirrorX(c.mask, c.players[0].x), hp: c.players[0].hp },
        { x: mirrorX(c.mask, c.players[1].x), hp: c.players[1].hp },
      ];
      const b = simulateShot(m, players, {
        ...c.input,
        x: mirrorX(c.mask, c.input.x),
        facing: c.input.facing === 1 ? -1 : 1,
        wind: -c.input.wind,
      });
      expect(b.result).toEqual(mirrorResult(a.result, c.mask.width));
    }
  });
});
