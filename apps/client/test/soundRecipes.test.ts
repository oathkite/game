import { describe, expect, it, vi } from "vitest";
import { WEAPON_IDS } from "@game/protocol";
import { createAudioContextMock } from "./audioContextMock";
import { playRecipe, type Layer, type Recipe, type SfxGraph } from "../src/app/sfx";
import { SOUNDS } from "../src/app/soundRecipes";
import { weaponSound } from "../src/app/weaponSounds";

const length = (recipe: Recipe) => Math.max(...recipe.layers.map((layer) => (layer.delay ?? 0) + layer.duration));
const lowest = (recipe: Recipe) => Math.min(...recipe.layers.filter((layer): layer is Extract<Layer, { kind: "tone" }> => layer.kind === "tone").map((layer) => layer.to));
const pitchDirection = (recipe: Recipe) => recipe.layers.filter((layer) => layer.kind === "tone").map((layer) => Math.sign(layer.to - layer.from));

describe("sound design", () => {
  it("has a layered sound for every weapon's shot and impact", () => {
    for (const weapon of WEAPON_IDS) {
      for (const event of ["fire", "impact"] as const) {
        const recipe = SOUNDS[weaponSound(weapon, event)];
        expect(recipe.layers.length, `${weapon} ${event}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("keeps rapid multi-stage impacts short so seven or nine in a row stay distinct", () => {
    expect(length(SOUNDS["laser-impact"])).toBeLessThanOrEqual(0.15);
    expect(length(SOUNDS["multiple-impact"])).toBeLessThanOrEqual(0.15);
  });

  it("gives the heavy blasts a long tail and a sub-bass drop the old single tones lacked", () => {
    for (const name of ["explosion", "digger-impact", "floater-impact", "finish"] as const) {
      expect(length(SOUNDS[name]), name).toBeGreaterThanOrEqual(0.7);
      expect(lowest(SOUNDS[name]), name).toBeLessThanOrEqual(35);
      expect(SOUNDS[name].duck, name).toBeGreaterThanOrEqual(0.4);
    }
    expect(length(SOUNDS.finish)).toBeGreaterThan(length(SOUNDS.explosion));
  });

  it("keeps being hit falling and landing a hit rising so the two never sound alike", () => {
    expect(pitchDirection(SOUNDS.hit).every((direction) => direction <= 0)).toBe(true);
    expect(pitchDirection(SOUNDS.hitConfirm)).toContain(1);
    expect(pitchDirection(SOUNDS.hitConfirm)).not.toContain(-1);
  });

  it("uses only audible, positive levels", () => {
    for (const [name, recipe] of Object.entries(SOUNDS)) {
      for (const layer of recipe.layers) {
        expect(layer.gain, name).toBeGreaterThan(0);
        expect(layer.gain, name).toBeLessThanOrEqual(1);
        expect(layer.from, name).toBeGreaterThanOrEqual(20);
        expect(layer.duration, name).toBeGreaterThan(0);
      }
    }
  });
});

describe("playRecipe", () => {
  const graph = (withNoise: boolean) => {
    const mock = createAudioContextMock();
    const space = { connect: vi.fn(), disconnect: vi.fn() };
    const noise = withNoise ? mock.ctx.createBuffer(1, 8000, 8000) : null;
    const value: SfxGraph = { ctx: mock.ctx as unknown as BaseAudioContext, output: {} as AudioNode, space: space as unknown as AudioNode, noise: noise as unknown as AudioBuffer | null };
    return { ...mock, space, graph: value };
  };

  it("starts one source per layer at the requested time, delayed layers later", () => {
    const { sources, graph: g } = graph(true);
    playRecipe(g, SOUNDS.finish, 3, () => 0.5);
    expect(sources).toHaveLength(SOUNDS.finish.layers.length);
    const starts = sources.map((source) => source.start.mock.calls[0]![0] as number);
    expect(Math.min(...starts)).toBe(3);
    expect(Math.max(...starts)).toBeCloseTo(3.18);
  });

  it("skips noise layers until the noise buffer exists", () => {
    const { sources, graph: g } = graph(false);
    playRecipe(g, SOUNDS.explosion, 0, () => 0.5);
    expect(sources.every((source) => source.kind === "tone")).toBe(true);
  });

  it("drives and sends to the reverb only when the recipe asks, then releases the voice after the last layer", () => {
    const { shapers, space, gains, sources, graph: g } = graph(true);
    playRecipe(g, SOUNDS.tick, 0, () => 0.5);
    expect(shapers).toHaveLength(0);
    expect(space.connect).not.toHaveBeenCalled();
    playRecipe(g, SOUNDS.explosion, 0, () => 0.5);
    expect(shapers).toHaveLength(1);
    const voice = gains[gains.length - SOUNDS.explosion.layers.length - 2]!;
    const longest = sources.slice(-SOUNDS.explosion.layers.length).reduce((a, b) => (a.stop.mock.calls[0]![0] >= b.stop.mock.calls[0]![0] ? a : b));
    longest.onended?.();
    expect(voice.disconnect).toHaveBeenCalled();
  });
});
