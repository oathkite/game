import { expect, it } from "vitest";
import { resultTitle } from "../src/worldUi/resultTitle";
it("shows personal outcomes and neutral spectator results", () => {
  const win = { type:"win", teamId:"t2" } as const;
  expect(resultTitle(win,"t2")).toBe("勝利");
  expect(resultTitle(win,"t1")).toBe("敗北");
  expect(resultTitle(win)).toBe("対戦結果");
  expect(resultTitle({type:"draw"},"t2")).toBe("引き分け");
});
