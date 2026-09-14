import { z } from "zod";
import type { WeaponId } from "./weapons.js";

export const WEAPON_DELAY: Readonly<Record<WeaponId, number>> = {
  cannon: 30, digger: 40, triple: 45, drill: 45, laser: 50, multiple: 65, floater: 50, stinger: 55,
};
export const ROUND_REVEAL_MS = 600;
export const PASS_DELAY = 65;
export const actionCost = (steps: number, weapon?: WeaponId): number => 50 + Math.max(0, Math.min(30, Math.round(steps))) + (weapon ? WEAPON_DELAY[weapon] : PASS_DELAY);
export const delaySchema = z.object({
  readyAt: z.record(z.string(), z.number().int().nonnegative()),
  clock: z.number().int().nonnegative(),
  revealUntil: z.number().optional(),
  previousOrder: z.array(z.string()).max(8).optional(),
  round: z.number().int().positive(),
  order: z.array(z.string()).min(2).max(8),
  costs: z.record(z.string(), z.number().int().nonnegative()),
  previous: z.record(z.string(), z.number().int().nonnegative()),
});
export type DelayState = z.infer<typeof delaySchema>;
export const createDelay = (order: readonly string[]): DelayState => ({ readyAt: Object.fromEntries(order.map(id => [id, 0])), clock: 0, round: 1, order: [...order], costs: {}, previous: {} });
export const finishDelay = (state: DelayState, id: string, cost: number): DelayState => ({ ...state, costs: { ...state.costs, [id]: cost } });
/** Advance the virtual clock after one committed action. Stable ties keep older reservations first. */
export const nextDelayTurn = (state: DelayState, eliminated: readonly string[] = []): DelayState => {
  const actor = Object.keys(state.costs)[0];
  const readyAt = actor ? { ...state.readyAt, [actor]: state.clock + state.costs[actor]! } : state.readyAt;
  const queue = [...state.order.filter(id => id !== actor), ...(actor ? [actor] : [])].filter(id => !eliminated.includes(id));
  const order = queue.sort((a, b) => readyAt[a]! - readyAt[b]!);
  return { ...state, round: state.round + 1, previousOrder: [...state.order],
    readyAt, clock: order.length ? readyAt[order[0]!]! : state.clock,
    order, costs: {}, previous: { ...state.previous, ...state.costs } };
};
