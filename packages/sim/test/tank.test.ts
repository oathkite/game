import { describe, expect, it } from "vitest";
import {
  isRingOut,
  MAP_HEIGHT,
  maskFromHeights,
  MAP_WIDTH,
  STEPS_PER_TURN,
  stepOutcome,
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
    expect(walk(flatMask(), 100, 1, STEPS_PER_TURN)).toEqual({ x: 115, stepsUsed: 15, fell: false });
    expect(walk(flatMask(), 100, -1, 3)).toEqual({ x: 97, stepsUsed: 3, fell: false });
  });

  it("1 セルの上りは進めて、2 セルの上りは進めない", () => {
    const step1 = heights((x) => (x < 100 ? 150 : 149));
    const step2 = heights((x) => (x < 100 ? 150 : 148));
    expect(stepOutcome(step1, 99, 1)).toBe("moved");
    expect(stepOutcome(step2, 99, 1)).toBe("blocked");
    expect(walk(step2, 95, 1, 15)).toEqual({ x: 99, stepsUsed: 4, fell: false });
  });

  it("下りは制限なく、判定半径より深い下りは落下で止まる", () => {
    const drop3 = heights((x) => (x < 100 ? 150 : 153));
    const drop4 = heights((x) => (x < 100 ? 150 : 154));
    expect(stepOutcome(drop3, 99, 1)).toBe("moved");
    expect(stepOutcome(drop4, 99, 1)).toBe("fell");
    expect(walk(drop4, 95, 1, 15)).toEqual({ x: 100, stepsUsed: 5, fell: true });
  });

  it("マップの端では止まる", () => {
    expect(walk(flatMask(), 2, -1, 15)).toEqual({ x: 0, stepsUsed: 2, fell: false });
    expect(walk(flatMask(), MAP_WIDTH - 1, 1, 15)).toEqual({ x: MAP_WIDTH - 1, stepsUsed: 0, fell: false });
  });

  it("落下したらそのターンの移動は終わり、検証も落下先までしか許さない", () => {
    const drop4 = heights((x) => (x < 100 ? 150 : 154));
    const first = walk(drop4, 95, 1, 15);
    expect(first).toEqual({ x: 100, stepsUsed: 5, fell: true });
    // クライアントは fell を見て以降の移動を止める。止めずに 1 歩進めた位置はサーバーが拒否する
    expect(validateMove(drop4, 95, 101)).toBe(false);
  });

  it("移動の検証は正味の移動を同じ規則で歩き直す（行って戻る経路は見ない）", () => {
    const mask = flatMask();
    expect(validateMove(mask, 100, 100)).toBe(true);
    expect(validateMove(mask, 100, 115)).toBe(true);
    expect(validateMove(mask, 100, 85)).toBe(true);
    expect(validateMove(mask, 100, 116)).toBe(false);
    const step2 = heights((x) => (x < 100 ? 150 : 148));
    expect(validateMove(step2, 95, 100)).toBe(false);
    expect(validateMove(step2, 95, 99)).toBe(true);
    const drop4 = heights((x) => (x < 100 ? 150 : 154));
    expect(validateMove(drop4, 95, 100)).toBe(true);
    expect(validateMove(drop4, 95, 101)).toBe(false);
  });
});
