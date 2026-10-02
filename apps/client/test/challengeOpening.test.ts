import { expect, it } from "vitest";
import { challengeOpeningOrder } from "../src/practice/opening";

// 的当ての開幕は通常の対戦と同じ流れで、自機から的へ回る（設計書 37）。固まった的を 1 つずつ回らないよう、残った的の中心へ 1 回だけ寄る
const target = (x: number, y: number, destroyed = false) => ({ id: `${x}`, x, y, destroyed });

it("自機、残った的の中心の順に回る", () => {
  expect(challengeOpeningOrder({ x: 60, y: 180 }, [target(195, 180), target(205, 180), target(215, 180)])).toEqual([{ x: 60, y: 180 }, { x: 205, y: 180 }]);
  expect(challengeOpeningOrder({ x: 60, y: 180 }, [target(174, 145), target(230, 180, true), target(274, 120)])).toEqual([{ x: 60, y: 180 }, { x: 224, y: 132.5 }]);
});

it("的が残っていなければ自機だけ", () => {
  expect(challengeOpeningOrder({ x: 60, y: 180 }, [])).toEqual([{ x: 60, y: 180 }]);
  expect(challengeOpeningOrder({ x: 60, y: 180 }, [target(100, 180, true)])).toEqual([{ x: 60, y: 180 }]);
});
