import { describe, expect, it } from "vitest";
import { simulateShot, type Combatant } from "../src/index.js";
import { flatMask, islandMask, shot, slopedMask, valleyMask, wallMask } from "./helpers.js";

// golden replay。最初の記録はこの実装で生成したもので、独立に導いた値ではない。
// 物理コードを変えたらスナップショットを更新し、差分が意図した変更だけであることをレビューで確認する。

const two = (x0: number, x1: number, hp0 = 100, hp1 = 100): readonly [Combatant, Combatant] => [
  { x: x0, hp: hp0 },
  { x: x1, hp: hp1 },
];

const cases = [
  { name: "谷 基本の直接射撃", mask: valleyMask, players: two(60, 340), input: shot({ x: 60, elevation: 45, power: 72, wind: 0 }) },
  { name: "谷 追い風 10", mask: valleyMask, players: two(60, 340), input: shot({ x: 60, elevation: 45, power: 72, wind: 10 }) },
  { name: "谷 向かい風 10", mask: valleyMask, players: two(60, 340), input: shot({ x: 60, elevation: 45, power: 72, wind: -10 }) },
  { name: "谷 山越えの高角度", mask: valleyMask, players: two(60, 340), input: shot({ x: 60, elevation: 80, power: 100, wind: 3 }) },
  { name: "谷 左向きから", mask: valleyMask, players: two(340, 60), input: shot({ seat: 0, x: 340, facing: -1, elevation: 45, power: 72, wind: 0 }) },
  { name: "平地 直撃", mask: flatMask, players: two(60, 72), input: shot({ x: 60, elevation: 10, power: 40, wind: 0 }) },
  { name: "平地 最小仰角 最小パワー", mask: flatMask, players: two(60, 340), input: shot({ x: 60, elevation: 10, power: 0, wind: 0 }) },
  { name: "平地 真上 最大パワー", mask: flatMask, players: two(200, 340), input: shot({ x: 200, elevation: 90, power: 100, wind: 0 }) },
  { name: "平地 右端から右へ 消失", mask: flatMask, players: two(390, 60), input: shot({ x: 390, elevation: 10, power: 100, wind: 0 }) },
  { name: "上り坂 +45 度", mask: () => slopedMask(6), players: two(100, 300), input: shot({ x: 100, elevation: 30, power: 60, wind: 0 }) },
  { name: "下り坂 -45 度", mask: () => slopedMask(-6), players: two(100, 300), input: shot({ x: 100, elevation: 10, power: 50, wind: 0 }) },
  { name: "壁の中で爆発 自爆", mask: () => wallMask(104, 130), players: two(100, 300), input: shot({ x: 100, elevation: 10, power: 50, wind: 0 }) },
  { name: "浮島 奈落へ 消失", mask: islandMask, players: two(60, 340), input: shot({ x: 118, elevation: 10, power: 30, wind: 0 }) },
  { name: "浮島 相手の足元を狙う", mask: islandMask, players: two(80, 300), input: shot({ x: 80, elevation: 50, power: 88, wind: -2 }) },
] as const;

describe("golden replay", () => {
  for (const c of cases) {
    it(c.name, () => {
      const out = simulateShot(c.mask(), c.players, c.input);
      expect({ result: out.result, steps: out.path.length, last: out.path[out.path.length - 1] }).toMatchSnapshot();
    });
  }
});
