import { expect, it } from "vitest";
import { createTankEffects } from "../src/prototype/tankEffects";
it("staggers three destruction bursts and removes all of them at 600ms", () => {
  const effects = createTankEffects();
  effects({ hp: 100 }, 0);
  const dead = { hp: 0 };
  expect(effects(dead, 10).filter(e => e.id === "effect-explosion")).toHaveLength(1);
  expect(effects(dead, 90).filter(e => e.id === "effect-explosion")).toHaveLength(2);
  expect(effects(dead, 150).filter(e => e.id === "effect-explosion")).toHaveLength(3);
  expect(effects(dead, 610).every(e => e.id === "effect-smoke")).toBe(true);
  expect(createTankEffects()(dead, 0).some(e => e.id === "effect-explosion")).toBe(false);
});
it("emits dust only after an observed fall, expires it, and suppresses optional effects", () => {
  const effects = createTankEffects();
  expect(effects({ hp: 100 }, 0)).toEqual([]);
  effects({ hp: 100, falling: true }, 10);
  expect(effects({ hp: 100 }, 20).filter(e => e.id === "effect-dust")).toHaveLength(3);
  expect(effects({ hp: 100 }, 470)).toEqual([]);
  expect(effects({ hp: 20 }, 500).filter(e => e.id === "effect-smoke")).toHaveLength(3);
  expect(effects({ hp: 20 }, 550, true)).toEqual([]);
});
it("plays authored hit sparks once per damage event and expires them after 300ms", () => {
  const effects = createTankEffects();
  effects({ hp: 100 }, 0);
  expect(effects({ hp: 80 }, 10).filter(e => e.id === "effect-spark").map(e => e.frame)).toEqual([0]);
  expect(effects({ hp: 80 }, 110).find(e => e.id === "effect-spark")?.frame).toBe(2);
  expect(effects({ hp: 80 }, 310)).toEqual([]);
  expect(effects({ hp: 60 }, 400).some(e => e.id === "effect-spark")).toBe(true);
  expect(effects({ hp: 40 }, 500, true)).toEqual([]);
  expect(createTankEffects()({ hp: 60 }, 0)).toEqual([]);
});
