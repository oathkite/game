import { describe, expect, it } from "vitest";
import {
  BLAST_RADIUS,
  carve,
  CLIMB_MAX,
  CLIMB_AHEAD,
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

  it("4セルまでの上りは進めて、5セルの上りは壁で進めない", () => {
    const allowedStep = heights((x) => (x < 100 ? 150 : 150 - CLIMB_MAX));
    const blockedStep = heights((x) => (x < 100 ? 150 : 150 - CLIMB_MAX - 1));
    expect(CLIMB_MAX).toBe(4);
    expect(stepOutcome(allowedStep, at(allowedStep, 99), 1)).toEqual({ kind: "moved", y: 146 });
    expect(stepOutcome(blockedStep, at(blockedStep, 99), 1)).toEqual({ kind: "blocked", y: 150 });
    expect(walk(blockedStep, at(blockedStep, 95), 1, 15)).toEqual({ x: 99, y: 150, stepsUsed: 4, fell: false });
  });

  it("4セルまでの下りは進めて、それより深い下りは落下で止まる", () => {
    const allowedDrop = heights((x) => (x < 100 ? 150 : 150 + CLIMB_MAX));
    const fallingDrop = heights((x) => (x < 100 ? 150 : 150 + CLIMB_MAX + 1));
    expect(stepOutcome(allowedDrop, at(allowedDrop, 99), 1)).toEqual({ kind: "moved", y: 154 });
    expect(stepOutcome(fallingDrop, at(fallingDrop, 99), 1)).toEqual({ kind: "fell", y: 155 });
    expect(walk(fallingDrop, at(fallingDrop, 95), 1, 15)).toEqual({ x: 100, y: 155, stepsUsed: 5, fell: true });
  });

  it("降りられた段差は同じ道を登って戻れる（上りと下りの閾値が同じ）", () => {
    const allowedStep = heights((x) => (x < 100 ? 150 : 150 - CLIMB_MAX));
    expect(stepOutcome(allowedStep, at(allowedStep, 99), 1).kind).toBe("moved");
    expect(stepOutcome(allowedStep, at(allowedStep, 100), -1).kind).toBe("moved");
  });

  it("前方 6 列で 6 セルより高く上がる（45 度より急な）上りには進めず、45 度までは登れる", () => {
    expect(CLIMB_AHEAD).toBe(6);
    // 1 列に 1 セル上がる坂（45 度）は、どこまでも登れる
    const even = heights((x) => (x < 100 ? 150 : 150 - (x - 100)));
    expect(walk(even, at(even, 95), 1, STEPS_PER_TURN)).toMatchObject({ x: 125, stepsUsed: STEPS_PER_TURN, fell: false });
    // 6 列で 7 セル上がる坂（約 49 度）は、坂に入る 1 歩目から進めない
    const steep = heights((x) => (x < 100 ? 150 : 150 - Math.floor(((x - 100) * 7) / 6)));
    const stopped = walk(steep, at(steep, 95), 1, STEPS_PER_TURN);
    expect(stopped).toMatchObject({ x: 100, y: 150, fell: false });
    expect(stepOutcome(steep, stopped, 1)).toEqual({ kind: "blocked", y: 150 });
  });

  it("前方 6 列のうちに 6 セルより高い所があれば、短い盛り上がりでも登れない", () => {
    // 1 列に 2 セル上がって 5 列目で 10 セルの頂に達し、また下がる盛り上がり。1 歩目の移動先から 6 列先は頂より 6 セル低い
    const mound = heights((x) => (x <= 100 || x >= 110 ? 150 : 150 - 2 * Math.min(x - 100, 110 - x)));
    const r = walk(mound, at(mound, 95), 1, STEPS_PER_TURN);
    expect(r).toMatchObject({ x: 100, y: 150, fell: false });
    expect(stepOutcome(mound, r, 1).kind).toBe("blocked");
    // 同じ形でも頂が 6 セルなら登って越えられる
    const low = heights((x) => (x <= 100 || x >= 106 ? 150 : 150 - 2 * Math.min(x - 100, 106 - x)));
    expect(walk(low, at(low, 95), 1, STEPS_PER_TURN)).toMatchObject({ x: 125, stepsUsed: STEPS_PER_TURN, fell: false });
  });

  it("天井は前方の地表と数えず、機体が立てる高さのトンネルでは 1 セルの段差を登れる", () => {
    // 床 150、105 列から 1 セル高い床。天井の下端は床から 7 セル上（機体の高さ 6 に 1 セルの余裕）
    const tunnel = heights((x) => (x >= 105 ? 149 : 150));
    for (let x = 0; x < MAP_WIDTH; x++) for (let y = 100; y < 143; y++) tunnel.cells[y * MAP_WIDTH + x] = 1;
    expect(walk(tunnel, { x: 90, y: 150 }, 1, STEPS_PER_TURN)).toMatchObject({ x: 120, y: 149, stepsUsed: STEPS_PER_TURN, fell: false });
    // 地面から続く高い壁は、天井と違って下に空きが無いので、これまでどおり壁と数える
    const wall = heights((x) => (x >= 108 ? 140 : x >= 105 ? 149 : 150));
    expect(walk(wall, { x: 90, y: 150 }, 1, STEPS_PER_TURN)).toMatchObject({ x: 104, y: 150, fell: false });
  });

  it("うしろが奈落や崖でも、前方の坂が緩ければ登れる", () => {
    // 左に地面のない浮島の縁から、3 列で 2 セル上がる坂を登る
    const edge = heights((x) => (x < 100 ? MAP_HEIGHT : 150 - Math.floor(((x - 100) * 2) / 3)));
    expect(walk(edge, at(edge, 100), 1, 20)).toMatchObject({ x: 120, stepsUsed: 20, fell: false });
    // 足元の 20 セル下に低い地面がある崖の上でも同じ
    const ledge = heights((x) => (x < 100 ? 170 : 150 - Math.floor(((x - 100) * 2) / 3)));
    expect(walk(ledge, at(ledge, 100), 1, 20)).toMatchObject({ x: 120, stepsUsed: 20, fell: false });
  });

  it("同じ形の段差は、どこから歩いてきたかに関わらず同じ結果になる", () => {
    // 平地の 2 セルの段差。車体の幅より後ろの地形だけを変えた 2 つで、段差を登れるかは変わらない
    const step = (behind: (x: number) => number) => heights((x) => (x >= 110 ? 148 : x >= 105 ? 150 : behind(x)));
    const flat = step(() => 150);
    const deepBehind = step((x) => 150 + 3 * (105 - x));
    for (const mask of [flat, deepBehind]) expect(stepOutcome(mask, at(mask, 109), 1)).toEqual({ kind: "moved", y: 148 });
  });

  it("1 歩で登れる段差でも、積み重なって 45 度より急な崖になれば登れない", () => {
    // 2 列ごとに 3 セルの段（約 56 度）。1 歩の段差は CLIMB_MAX 以内
    const stairs = heights((x) => (x < 100 ? 150 : 150 - 3 * (Math.floor((x - 100) / 2) + 1)));
    const r = walk(stairs, at(stairs, 95), 1, STEPS_PER_TURN);
    expect(r).toMatchObject({ x: 99, y: 150, fell: false });
    expect(stepOutcome(stairs, r, 1).kind).toBe("blocked");
  });

  it("主砲のクレーターは降りられるが、縁が 45 度より急なので登って出られない", () => {
    const one = carve(flatMask(150), { cx: 100, cy: 150, radius: BLAST_RADIUS });
    const down = walk(one, at(one, 85), 1, STEPS_PER_TURN);
    expect(down.x).toBeGreaterThan(100);
    expect(down.y).toBeGreaterThan(150 + CLIMB_MAX);
    for (const dir of [-1, 1] as const) {
      const out = [0, 1, 2].reduce((pos) => walk(one, pos, dir, STEPS_PER_TURN), { x: 100, y: groundBelow(one, 100, 0) });
      expect(out.y).toBeGreaterThan(150 + CLIMB_MAX);
    }
  });

  it("登れない急な坂も下りは進める", () => {
    const steep = heights((x) => (x < 100 ? 150 : 150 - (x - 100)));
    expect(walk(steep, at(steep, 130), -1, STEPS_PER_TURN)).toMatchObject({ x: 100, y: 150, stepsUsed: STEPS_PER_TURN, fell: false });
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

  it("落下でコマンドは止まるが着地後の移動先まで検証できる", () => {
    const fallingDrop = heights((x) => (x < 100 ? 150 : 157));
    const first = walk(fallingDrop, at(fallingDrop, 95), 1, 15);
    expect(first).toEqual({ x: 100, y: 157, stepsUsed: 5, fell: true });
    // 着地後に残り移動量を使って進める。
    expect(validateMove(fallingDrop, at(fallingDrop, 95), 101)).toEqual({ x:101, y:157 });
  });

  it("移動の検証は正味の移動を同じ規則で歩き直し、移動後の位置を返す（行って戻る経路は見ない）", () => {
    const mask = flatMask();
    expect(validateMove(mask, at(mask, 100), 100)).toEqual({ x: 100, y: 150 });
    expect(validateMove(mask, at(mask, 100), 100 + STEPS_PER_TURN)).toEqual({ x: 100 + STEPS_PER_TURN, y: 150 });
    expect(validateMove(mask, at(mask, 100), 100 - STEPS_PER_TURN)).toEqual({ x: 100 - STEPS_PER_TURN, y: 150 });
    expect(validateMove(mask, at(mask, 100), 100 + STEPS_PER_TURN + 1)).toBeNull();
    const blockedStep = heights((x) => (x < 100 ? 150 : 143));
    expect(validateMove(blockedStep, at(blockedStep, 95), 100)).toBeNull();
    expect(validateMove(blockedStep, at(blockedStep, 95), 99)).toEqual({ x: 99, y: 150 });
    const fallingDrop = heights((x) => (x < 100 ? 150 : 157));
    expect(validateMove(fallingDrop, at(fallingDrop, 95), 100)).toEqual({ x: 100, y: 157 });
    expect(validateMove(fallingDrop, at(fallingDrop, 95), 101)).toEqual({ x:101, y:157 });
  });
});
