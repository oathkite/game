import { applyOps, maskFromHeights } from "@game/sim";
import { RULE_SET_VERSION } from "./lobby.js";
import type { BattleSession } from "./session.js";

type Replay = NonNullable<BattleSession["replay"]>;
type StoredReplay = Omit<Replay, "shot"> & { readonly shot: Omit<Replay["shot"], "mask"> };
export type BattleSnapshot = {
  readonly version: 1;
  readonly state: Omit<BattleSession, "mask" | "replay"> & { readonly replay: StoredReplay | null };
};
/** Server-private snapshot. Terrain derives from its frozen surface and committed operations. */
export const serializeBattle = (battle: BattleSession): BattleSnapshot => {
  const { mask: _mask, replay, ...state } = battle;
  if (!replay) return { version: 1, state: { ...state, replay: null } };
  const { mask: _shotMask, ...shot } = replay.shot;
  return { version: 1, state: { ...state, replay: { ...replay, shot } } };
};
export const restoreBattle = (snapshot: BattleSnapshot): BattleSession => {
  if (snapshot.version !== 1 || snapshot.state.ruleSetVersion !== RULE_SET_VERSION) throw new Error("unsupported battle snapshot version");
  const { state } = snapshot;
  const mask = applyOps(maskFromHeights(state.map.surface, state.map.height), state.terrainOps);
  return { ...state, mask, replay: state.replay ? { ...state.replay, shot: { ...state.replay.shot, mask } } : null };
};
