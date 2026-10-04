import { expect, it } from "vitest";
import { choosePosition, type PositionOption } from "../src/practice/cpuPosition";

const option = (x: number, steps: number, canHit: boolean, exposed = false, miss = 0): PositionOption =>
  ({ x, steps, canHit, exposed, miss, path: [], fire: { type: "turn.fire", x, facing: -1, slot: 0, elevation: 45, power: 60 } });
const stay = (canHit: boolean, exposed = false, miss = 0) => option(300, 0, canHit, exposed, miss);

it("当てられて狙われていなければ、乱数が大きいと留まる", () => {
  const options = [stay(true), option(294, 6, true), option(306, 6, true)];
  expect(choosePosition(options, () => 0.35).x).toBe(300);
  expect(choosePosition(options, () => 0.9).x).toBe(300);
});

it("当てられて狙われていなくても、乱数が小さければ当てられる別の位置へ動く", () => {
  const options = [stay(true), option(294, 6, false), option(306, 6, true, true), option(312, 12, true)];
  expect(choosePosition(options, () => 0).x).toBe(312);
});

it("位置を変える先が無ければ留まる", () => {
  const options = [stay(true), option(294, 6, false), option(306, 6, true, true)];
  expect(choosePosition(options, () => 0).x).toBe(300);
});

it("今の位置から当てられなければ、当てられる位置のうち歩数の少ない方へ動く", () => {
  const options = [stay(false, false, 40), option(294, 6, false, false, 30), option(288, 12, true), option(306, 6, true), option(318, 18, true)];
  for (const roll of [0, 0.5, 0.99]) expect(choosePosition(options, () => roll).x).toBe(306);
});

it("狙われていれば、当てられて狙われていない位置へ逃げる", () => {
  const options = [stay(true, true), option(294, 6, true, true), option(288, 12, true), option(306, 6, false), option(318, 18, true)];
  for (const roll of [0, 0.5, 0.99]) expect(choosePosition(options, () => roll).x).toBe(288);
});

it("逃げても当てられないなら、狙われていても当てられる位置に留まる", () => {
  const options = [stay(true, true), option(294, 6, false), option(306, 6, true, true)];
  expect(choosePosition(options, () => 0).x).toBe(300);
});

it("歩数が同じなら着弾が相手に近い方を選ぶ", () => {
  const options = [stay(false, false, 40), option(294, 6, true, false, 3), option(306, 6, true, false, 1)];
  expect(choosePosition(options, () => 0).x).toBe(306);
});

it("どこからも当てられなければ、狙われていない位置のうち着弾が相手に最も近い位置を選ぶ", () => {
  const options = [stay(false, true, 10), option(294, 6, false, false, 30), option(288, 12, false, false, 20), option(306, 6, false, true, 5)];
  expect(choosePosition(options, () => 0.5).x).toBe(288);
  const allExposed = options.map(o => ({ ...o, exposed: true }));
  expect(choosePosition(allExposed, () => 0.5).x).toBe(306);
});

it("候補が留まるだけなら留まる", () => {
  expect(choosePosition([stay(false, true, 50)], () => 0).x).toBe(300);
});
