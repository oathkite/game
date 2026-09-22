import { expect, it } from "vitest";
import { CARET_PERIOD_MS, caretBob } from "../src/game/turnCaret";

it("bobs upward in whole 2 px dots and repeats every period", () => {
  const samples = Array.from({ length: 64 }, (_, i) => caretBob(i * CARET_PERIOD_MS / 64, false));
  expect(new Set(samples)).toEqual(new Set([0, -2, -4]));
  expect(caretBob(0, false)).toBe(-2);
  expect(caretBob(CARET_PERIOD_MS / 4, false)).toBe(-4);
  expect(caretBob(CARET_PERIOD_MS * 3 / 4, false)).toBe(0);
  expect(caretBob(CARET_PERIOD_MS * 5 + 123, false)).toBe(caretBob(123, false));
});

it("stays still when the OS asks for reduced motion", () => {
  for (const t of [0, CARET_PERIOD_MS / 4, CARET_PERIOD_MS * 3 / 4, 99_999]) expect(caretBob(t, true)).toBe(0);
});
