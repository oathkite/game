import { initialWind, nextWind, WIND_MAX, WIND_DELTA_MAX } from "@game/sim";

/** Private server state. Only value is included in public snapshots. */
export type BattleWind = { readonly seed: number; readonly value: number };
const draw = (seed: number, range: number) => {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let value = Math.imul(next ^ (next >>> 15), next | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { seed: next, value: Math.floor(((value ^ (value >>> 14)) >>> 0) / 4294967296 * range) };
};
export const createBattleWind = (seed: number): BattleWind => {
  const roll = draw(seed, 2 * WIND_MAX + 1);
  return { seed: roll.seed, value: initialWind(roll.value).value };
};
export const advanceBattleWind = (state: BattleWind): BattleWind => {
  const gust = draw(state.seed, 100), value = draw(gust.seed, 2 * WIND_MAX + 1);
  const delta = draw(value.seed, 2 * WIND_DELTA_MAX + 1);
  return { seed: delta.seed, value: nextWind({ value: state.value }, {
    gust: gust.value, value: value.value, delta: delta.value,
  }).wind.value };
};
