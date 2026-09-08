import { describe, expect, it } from "vitest";
import {
  BLAST_RADIUS,
  carve,
  CLIMB_MAX,
  isRingOut,
  MAP_HEIGHT,
  maskFromHeights,
  MAP_WIDTH,
  STEPS_PER_TURN,
  stepOutcome,
  surfaceY,
  tankCenterY,
  tiltOf,
  validateMove,
  walk,
} from "../src/index.js";
import { flatMask, islandMask, slopedMask } from "./helpers.js";

const heights = (fn: (x: number) => number) => maskFromHeights(Array.from({ length: MAP_WIDTH }, (_, x) => fn(x)), MAP_HEIGHT);

describe("機体の位置と傾き", () => {
  it("中心は地表から判定半径だけ上", () => {
    expect(tankCenterY(flatMask(150), 10)).toBe(147);
  });

  it("平坦なら傾き 0、右が高いと正、左が高いと負", () => {
    expect(tiltOf(flatMask(), 100)).toBe(0);
    expect(tiltOf(slopedMask(6), 100)).toBe(45);
    expect(tiltOf(slopedMask(-6), 100)).toBe(-45);
    expect(tiltOf(slopedMask(3), 100)).toBe(27);
  });

  it("マップの端では範囲内の列で代用し、平地なら傾き 0 のまま", () => {
    expect(tiltOf(flatMask(), 0)).toBe(0);
    expect(tiltOf(flatMask(), 2)).toBe(0);
    expect(tiltOf(flatMask(), MAP_WIDTH - 1)).toBe(0);
  });

  it("高さの差が 6 を超えても傾きは 45 度で頭打ち", () => {
    const cliff = heights((x) => (x < 100 ? 170 : 140));
    expect(tiltOf(cliff, 100)).toBe(45);
    expect(tiltOf(cliff, 99)).toBe(45);
  });

  it("地面のない列はリングアウト", () => {
    expect(isRingOut(islandMask(), 200)).toBe(true);
    expect(isRingOut(islandMask(), 80)).toBe(false);
  });
});

describe("移動", () => {
  it("平坦なら歩数の上限まで進む", () => {
    expect(walk(flatMask(), 100, 1, STEPS_PER_TURN)).toEqual({ x: 100 + STEPS_PER_TURN, stepsUsed: STEPS_PER_TURN, fell: false });
    expect(walk(flatMask(), 100, -1, 3)).toEqual({ x: 97, stepsUsed: 3, fell: false });
  });

  it("車体の高さ（6 セル）までの上りは進めて、7 セルの上りは壁で進めない", () => {
    const step6 = heights((x) => (x < 100 ? 150 : 150 - CLIMB_MAX));
    const step7 = heights((x) => (x < 100 ? 150 : 150 - CLIMB_MAX - 1));
    expect(CLIMB_MAX).toBe(6);
    expect(stepOutcome(step6, 99, 1)).toBe("moved");
    expect(stepOutcome(step7, 99, 1)).toBe("blocked");
    expect(walk(step7, 95, 1, 15)).toEqual({ x: 99, stepsUsed: 4, fell: false });
  });

  it("車体の高さまでの下りは進めて、それより深い下りは落下で止まる", () => {
    const drop6 = heights((x) => (x < 100 ? 150 : 150 + CLIMB_MAX));
    const drop7 = heights((x) => (x < 100 ? 150 : 150 + CLIMB_MAX + 1));
    expect(stepOutcome(drop6, 99, 1)).toBe("moved");
    expect(stepOutcome(drop7, 99, 1)).toBe("fell");
    expect(walk(drop7, 95, 1, 15)).toEqual({ x: 100, stepsUsed: 5, fell: true });
  });

  it("降りられた段差は同じ道を登って戻れる（上りと下りの閾値が同じ）", () => {
    const step6 = heights((x) => (x < 100 ? 150 : 150 - CLIMB_MAX));
    expect(stepOutcome(step6, 99, 1)).toBe("moved");
    expect(stepOutcome(step6, 100, -1)).toBe("moved");
  });

  it("単発のクレーターは縁を越えて通り抜けられ、2 発重なった崖は登れない", () => {
    const flat = flatMask(150);
    const one = carve(flat, { cx: 100, cy: 150, radius: BLAST_RADIUS });
    expect(walk(one, 85, 1, STEPS_PER_TURN)).toEqual({ x: 115, stepsUsed: STEPS_PER_TURN, fell: false });
    expect(walk(one, 115, -1, STEPS_PER_TURN)).toEqual({ x: 85, stepsUsed: STEPS_PER_TURN, fell: false });
    // 同じ場所を 2 発削ると縁が 13 セルの崖になり、底に降りたら落下で止まり、登って出られない
    const two = carve(one, { cx: 100, cy: surfaceY(one, 100), radius: BLAST_RADIUS });
    const down = walk(two, 85, 1, STEPS_PER_TURN);
    expect(down.fell).toBe(true);
    expect(stepOutcome(two, down.x, -1)).toBe("blocked");
  });

  it("マップの端では止まる", () => {
    expect(walk(flatMask(), 2, -1, 15)).toEqual({ x: 0, stepsUsed: 2, fell: false });
    expect(walk(flatMask(), MAP_WIDTH - 1, 1, 15)).toEqual({ x: MAP_WIDTH - 1, stepsUsed: 0, fell: false });
  });

  it("落下したらそのターンの移動は終わり、検証も落下先までしか許さない", () => {
    const drop7 = heights((x) => (x < 100 ? 150 : 157));
    const first = walk(drop7, 95, 1, 15);
    expect(first).toEqual({ x: 100, stepsUsed: 5, fell: true });
    // クライアントは fell を見て以降の移動を止める。止めずに 1 歩進めた位置はサーバーが拒否する
    expect(validateMove(drop7, 95, 101)).toBe(false);
  });

  it("移動の検証は正味の移動を同じ規則で歩き直す（行って戻る経路は見ない）", () => {
    const mask = flatMask();
    expect(validateMove(mask, 100, 100)).toBe(true);
    expect(validateMove(mask, 100, 100 + STEPS_PER_TURN)).toBe(true);
    expect(validateMove(mask, 100, 100 - STEPS_PER_TURN)).toBe(true);
    expect(validateMove(mask, 100, 100 + STEPS_PER_TURN + 1)).toBe(false);
    const step7 = heights((x) => (x < 100 ? 150 : 143));
    expect(validateMove(step7, 95, 100)).toBe(false);
    expect(validateMove(step7, 95, 99)).toBe(true);
    const drop7 = heights((x) => (x < 100 ? 150 : 157));
    expect(validateMove(drop7, 95, 100)).toBe(true);
    expect(validateMove(drop7, 95, 101)).toBe(false);
  });
});
