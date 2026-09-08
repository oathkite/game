import { describe, expect, it } from "vitest";
import {
  BLAST_RADIUS,
  carve,
  CLIMB_MAX,
  groundBelow,
  hasClearance,
  isRingOut,
  MAP_HEIGHT,
  maskFromHeights,
  MAP_WIDTH,
  settle,
  spawnPos,
  STEPS_PER_TURN,
  stepOutcome,
  surfaceY,
  tankCenterY,
  tiltOf,
  validateMove,
  walk,
  type TerrainMask,
} from "../src/index.js";
import { flatMask, islandMask, slopedMask } from "./helpers.js";

const heights = (fn: (x: number) => number) => maskFromHeights(Array.from({ length: MAP_WIDTH }, (_, x) => fn(x)), MAP_HEIGHT);

/** 上から見た地表に立つ位置 */
const at = (mask: TerrainMask, x: number) => spawnPos(mask, x);

/** 地表 floor の上に、ceilingTop から ceilingBottom 未満の天井を持つ洞窟 */
const cave = (floor: number, ceilingTop: number, ceilingBottom: number): TerrainMask => {
  const mask = flatMask(floor);
  const cells = new Uint8Array(mask.cells);
  for (let y = ceilingTop; y < ceilingBottom; y++) for (let x = 0; x < MAP_WIDTH; x++) cells[y * MAP_WIDTH + x] = 1;
  return { ...mask, cells };
};

describe("機体の位置と傾き", () => {
  it("中心は地表から判定半径だけ上", () => {
    expect(tankCenterY(at(flatMask(150), 10))).toBe(147);
  });

  it("スポーンは fromY から下へ見て最初の地面。天井の下に置ける", () => {
    const m = cave(150, 60, 72);
    expect(spawnPos(m, 100).y).toBe(60);
    expect(spawnPos(m, 100, 80).y).toBe(150);
    expect(groundBelow(m, 100, 72)).toBe(150);
    expect(groundBelow(m, 100, -5)).toBe(60);
  });

  it("平坦なら傾き 0、右が高いと正、左が高いと負", () => {
    expect(tiltOf(flatMask(), at(flatMask(), 100))).toBe(0);
    expect(tiltOf(slopedMask(6), at(slopedMask(6), 100))).toBe(45);
    expect(tiltOf(slopedMask(-6), at(slopedMask(-6), 100))).toBe(-45);
    expect(tiltOf(slopedMask(3), at(slopedMask(3), 100))).toBe(27);
  });

  it("マップの端では範囲内の列で代用し、平地なら傾き 0 のまま", () => {
    expect(tiltOf(flatMask(), at(flatMask(), 0))).toBe(0);
    expect(tiltOf(flatMask(), at(flatMask(), 2))).toBe(0);
    expect(tiltOf(flatMask(), at(flatMask(), MAP_WIDTH - 1))).toBe(0);
  });

  it("高さの差が 6 を超えても傾きは 45 度で頭打ち", () => {
    const cliff = heights((x) => (x < 100 ? 170 : 140));
    expect(tiltOf(cliff, at(cliff, 100))).toBe(45);
    expect(tiltOf(cliff, at(cliff, 99))).toBe(45);
  });

  it("天井の下では傾きは床で測り、天井に影響されない", () => {
    const m = cave(150, 60, 72);
    expect(tiltOf(m, spawnPos(m, 100, 80))).toBe(0);
  });

  it("地面のない列はリングアウト", () => {
    expect(isRingOut(islandMask(), at(islandMask(), 200))).toBe(true);
    expect(isRingOut(islandMask(), at(islandMask(), 80))).toBe(false);
  });

  it("足元が残っていれば動かず、失えば真下の次の地面まで落ち、なければ奈落", () => {
    const m = cave(150, 60, 72);
    const onCeiling = spawnPos(m, 100);
    expect(settle(m, onCeiling)).toEqual(onCeiling);
    const holed = { ...m, cells: m.cells.map((v, i) => (i % MAP_WIDTH === 100 && Math.floor(i / MAP_WIDTH) < 72 ? 0 : v)) };
    expect(settle(holed, onCeiling)).toEqual({ x: 100, y: 150 });
    expect(settle(islandMask(), { x: 200, y: 100 })).toEqual({ x: 200, y: MAP_HEIGHT });
  });
});

describe("移動", () => {
  it("平坦なら歩数の上限まで進む", () => {
    const m = flatMask();
    expect(walk(m, at(m, 100), 1, STEPS_PER_TURN)).toEqual({ x: 100 + STEPS_PER_TURN, y: 150, stepsUsed: STEPS_PER_TURN, fell: false });
    expect(walk(m, at(m, 100), -1, 3)).toEqual({ x: 97, y: 150, stepsUsed: 3, fell: false });
  });

  it("車体の高さ（6 セル）までの上りは進めて、7 セルの上りは壁で進めない", () => {
    const step6 = heights((x) => (x < 100 ? 150 : 150 - CLIMB_MAX));
    const step7 = heights((x) => (x < 100 ? 150 : 150 - CLIMB_MAX - 1));
    expect(CLIMB_MAX).toBe(6);
    expect(stepOutcome(step6, at(step6, 99), 1)).toEqual({ kind: "moved", y: 144 });
    expect(stepOutcome(step7, at(step7, 99), 1)).toEqual({ kind: "blocked", y: 150 });
    expect(walk(step7, at(step7, 95), 1, 15)).toEqual({ x: 99, y: 150, stepsUsed: 4, fell: false });
  });

  it("車体の高さまでの下りは進めて、それより深い下りは落下で止まる", () => {
    const drop6 = heights((x) => (x < 100 ? 150 : 150 + CLIMB_MAX));
    const drop7 = heights((x) => (x < 100 ? 150 : 150 + CLIMB_MAX + 1));
    expect(stepOutcome(drop6, at(drop6, 99), 1)).toEqual({ kind: "moved", y: 156 });
    expect(stepOutcome(drop7, at(drop7, 99), 1)).toEqual({ kind: "fell", y: 157 });
    expect(walk(drop7, at(drop7, 95), 1, 15)).toEqual({ x: 100, y: 157, stepsUsed: 5, fell: true });
  });

  it("降りられた段差は同じ道を登って戻れる（上りと下りの閾値が同じ）", () => {
    const step6 = heights((x) => (x < 100 ? 150 : 150 - CLIMB_MAX));
    expect(stepOutcome(step6, at(step6, 99), 1).kind).toBe("moved");
    expect(stepOutcome(step6, at(step6, 100), -1).kind).toBe("moved");
  });

  it("単発のクレーターは縁を越えて通り抜けられ、2 発重なった崖は登れない", () => {
    const flat = flatMask(150);
    const one = carve(flat, { cx: 100, cy: 150, radius: BLAST_RADIUS });
    expect(walk(one, at(one, 85), 1, STEPS_PER_TURN)).toMatchObject({ x: 115, stepsUsed: STEPS_PER_TURN, fell: false });
    expect(walk(one, at(one, 115), -1, STEPS_PER_TURN)).toMatchObject({ x: 85, stepsUsed: STEPS_PER_TURN, fell: false });
    // 同じ場所を 2 発削ると縁が 13 セルの崖になり、底に降りたら落下で止まり、登って出られない。
    // 縁のひさしの下の窪みには 1 歩だけ入れるが、その先は壁で進めない
    const two = carve(one, { cx: 100, cy: surfaceY(one, 100), radius: BLAST_RADIUS });
    const down = walk(two, at(two, 85), 1, STEPS_PER_TURN);
    expect(down.fell).toBe(true);
    const back = walk(two, down, -1, STEPS_PER_TURN);
    expect(back.stepsUsed).toBeLessThanOrEqual(1);
    expect(back.x).toBeGreaterThanOrEqual(down.x - 1);
  });

  it("踏み外した先は真下の次の地面で、なければ奈落", () => {
    const island = islandMask();
    // 80 を含む島の右端の列
    let edgeX = 80;
    while (spawnPos(island, edgeX + 1).y < MAP_HEIGHT) edgeX++;
    const r = walk(island, spawnPos(island, edgeX), 1, 5);
    expect(r).toMatchObject({ x: edgeX + 1, stepsUsed: 1, fell: true });
    expect(isRingOut(island, r)).toBe(true);
  });

  it("機体の高さぶん空いていない列（壁、低い天井）には進めない", () => {
    // 7 セルの壁は地表として見つからず、壁の中に立つことになるので進めない
    const wall = heights((x) => (x < 100 ? 150 : 143));
    expect(stepOutcome(wall, at(wall, 99), 1).kind).toBe("blocked");
    // 天井が地表から 5 セル上まで迫っている
    const low = cave(150, 140, 145);
    expect(hasClearance(low, 100, 150)).toBe(false);
    expect(stepOutcome(low, spawnPos(low, 99, 146), 1).kind).toBe("blocked");
    // 6 セル空いていれば通れる
    const ok = cave(150, 140, 144);
    expect(stepOutcome(ok, spawnPos(ok, 99, 145), 1)).toEqual({ kind: "moved", y: 150 });
  });

  it("天井の下を歩いても天井の上には上がらない", () => {
    const m = cave(150, 60, 72);
    const r = walk(m, spawnPos(m, 100, 80), 1, STEPS_PER_TURN);
    expect(r).toEqual({ x: 130, y: 150, stepsUsed: STEPS_PER_TURN, fell: false });
  });

  it("マップの端では止まる", () => {
    const m = flatMask();
    expect(walk(m, at(m, 2), -1, 15)).toEqual({ x: 0, y: 150, stepsUsed: 2, fell: false });
    expect(walk(m, at(m, MAP_WIDTH - 1), 1, 15)).toEqual({ x: MAP_WIDTH - 1, y: 150, stepsUsed: 0, fell: false });
  });

  it("落下したらそのターンの移動は終わり、検証も落下先までしか許さない", () => {
    const drop7 = heights((x) => (x < 100 ? 150 : 157));
    const first = walk(drop7, at(drop7, 95), 1, 15);
    expect(first).toEqual({ x: 100, y: 157, stepsUsed: 5, fell: true });
    // クライアントは fell を見て以降の移動を止める。止めずに 1 歩進めた位置はサーバーが拒否する
    expect(validateMove(drop7, at(drop7, 95), 101)).toBeNull();
  });

  it("移動の検証は正味の移動を同じ規則で歩き直し、移動後の位置を返す（行って戻る経路は見ない）", () => {
    const mask = flatMask();
    expect(validateMove(mask, at(mask, 100), 100)).toEqual({ x: 100, y: 150 });
    expect(validateMove(mask, at(mask, 100), 100 + STEPS_PER_TURN)).toEqual({ x: 100 + STEPS_PER_TURN, y: 150 });
    expect(validateMove(mask, at(mask, 100), 100 - STEPS_PER_TURN)).toEqual({ x: 100 - STEPS_PER_TURN, y: 150 });
    expect(validateMove(mask, at(mask, 100), 100 + STEPS_PER_TURN + 1)).toBeNull();
    const step7 = heights((x) => (x < 100 ? 150 : 143));
    expect(validateMove(step7, at(step7, 95), 100)).toBeNull();
    expect(validateMove(step7, at(step7, 95), 99)).toEqual({ x: 99, y: 150 });
    const drop7 = heights((x) => (x < 100 ? 150 : 157));
    expect(validateMove(drop7, at(drop7, 95), 100)).toEqual({ x: 100, y: 157 });
    expect(validateMove(drop7, at(drop7, 95), 101)).toBeNull();
  });
});
