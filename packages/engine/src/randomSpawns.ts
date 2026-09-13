import type { TankPos } from "@game/sim";

/** Sample distinct validated footholds, rather than nudging fixed start positions. */
export const randomSpawns = (candidates: readonly TankPos[], count: number, rng: () => number): readonly TankPos[] => {
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, count);
};
