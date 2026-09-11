import { expect, it } from "vitest";
import { fitTankLabel } from "../src/game/tankLabelLayout";
const bounds = { x: -48, y: -21, width: 96, height: 30 };
const viewport = { width: 667, height: 159 };
it("keeps the complete plate inside the top and side edges", () => {
  expect(fitTankLabel({ x: 20, y: -10 }, { x: 20, y: 80 }, bounds, viewport)).toEqual({ x: 52, y: 25 });
  expect(fitTankLabel({ x: 660, y: 160 }, { x: 660, y: 150 }, bounds, viewport)).toEqual({ x: 615, y: 146 });
});
it("does not pin labels for tanks outside the viewport", () => {
  expect(fitTankLabel({ x: -100, y: -10 }, { x: -100, y: 80 }, bounds, viewport)).toEqual({ x: -100, y: -10 });
});
it("leaves a fully visible plate at its natural position", () => {
  expect(fitTankLabel({ x: 300, y: 50 }, { x: 300, y: 130 }, bounds, viewport)).toEqual({ x: 300, y: 50 });
});
