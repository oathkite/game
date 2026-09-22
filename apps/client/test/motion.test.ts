import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { charCount, prefersReducedMotion, startTicker, typedText } from "../src/worldUi/motion";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it("types one character per step and never exceeds the text", () => {
  expect(typedText("接続中", 0, 28)).toBe("");
  expect(typedText("接続中", 27, 28)).toBe("");
  expect(typedText("接続中", 28, 28)).toBe("接");
  expect(typedText("接続中", 56, 28)).toBe("接続");
  expect(typedText("接続中", 10_000, 28)).toBe("接続中");
  expect(typedText("接続中", -40, 28)).toBe("");
  expect(typedText("", 100, 28)).toBe("");
});
it("counts surrogate pairs as single characters", () => {
  expect(charCount("𠮷野家")).toBe(3);
  expect(typedText("𠮷野家", 28, 28)).toBe("𠮷");
});
it("ticks at a fixed step and stops after the last tick", () => {
  const ticks: number[] = [];
  startTicker(40, 3, tick => ticks.push(tick));
  vi.advanceTimersByTime(39);
  expect(ticks).toEqual([]);
  vi.advanceTimersByTime(1);
  expect(ticks).toEqual([1]);
  vi.advanceTimersByTime(400);
  expect(ticks).toEqual([1, 2, 3]);
  expect(vi.getTimerCount()).toBe(0);
});
it("can be stopped early and ignores empty runs", () => {
  const onTick = vi.fn();
  const stop = startTicker(40, 5, onTick);
  vi.advanceTimersByTime(80);
  stop();
  vi.advanceTimersByTime(400);
  expect(onTick).toHaveBeenCalledTimes(2);
  startTicker(40, 0, onTick)();
  expect(vi.getTimerCount()).toBe(0);
});
it("treats environments without matchMedia as full motion", () => {
  expect(prefersReducedMotion()).toBe(false);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
  try { expect(prefersReducedMotion()).toBe(true); } finally { vi.unstubAllGlobals(); }
});
