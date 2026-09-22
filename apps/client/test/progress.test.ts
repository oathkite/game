import { expect, it } from "vitest";
import { parseProgress, recordClear, nextStageIndex } from "../src/practice/progress";

it("保存値を検査し、良い記録だけを残す", () => {
  expect(parseProgress("broken")).toEqual({});
  expect(parseProgress('{"01":2,"02":-1,"03":"1","04":1.5,"99":2}')).toEqual({ "01": 2 });
  expect(recordClear({ "01": 2 }, "01", 4)).toEqual({ "01": 2 });
  expect(recordClear({ "01": 2 }, "01", 1)).toEqual({ "01": 1 });
  expect(nextStageIndex({ "01": 2, "02": 3 })).toBe(2);
});

it("壊れた保存値と全クリアを扱う", () => {
  for (const raw of [null, "null", "[]", "true", "123"]) expect(parseProgress(raw)).toEqual({});
  expect(nextStageIndex(Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i + 1).padStart(2, "0"), 1])))).toBe(0);
});

import { vi, afterEach } from "vitest";
import { loadProgress, saveProgress, PROGRESS_KEY } from "../src/practice/progress";
afterEach(() => vi.unstubAllGlobals());
it("保存拒否でも例外にせず、保存成功時は検査済み記録を復元する", () => {
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } });
  expect(loadProgress()).toEqual({});
  expect(saveProgress({ "01": 2 })).toBe(false);
  const setItem = vi.fn();
  vi.stubGlobal("localStorage", { getItem: () => '{"01":2}', setItem });
  expect(loadProgress()).toEqual({ "01": 2 });
  expect(saveProgress({ "01": 1 })).toBe(true);
  expect(setItem).toHaveBeenCalledWith(PROGRESS_KEY, '{"01":1}');
});
