import { compatibleMatch, LEGACY_CLIENT_BUILD } from "@game/protocol/build";
import { applyOps, maskFromHeights } from "@game/sim";
import { RULE_SET_VERSION } from "./lobby.js";
import type { BattleSession } from "./session.js";

type Replay = NonNullable<BattleSession["replay"]>;
type StoredReplay = Omit<Replay, "shot"> & { readonly shot: Omit<Replay["shot"], "mask"> };
export type BattleSnapshot = {
  readonly version: 2;
  readonly state: Omit<BattleSession, "mask" | "replay"> & { readonly replay: StoredReplay | null };
};
/** Server-private snapshot. Terrain derives from its frozen surface and committed operations. */
export const serializeBattle = (battle: BattleSession): BattleSnapshot => {
  const { mask: _mask, replay, ...state } = battle;
  if (!replay) return { version: 2, state: { ...state, replay: null } };
  const { mask: _shotMask, ...shot } = replay.shot;
  return { version: 2, state: { ...state, replay: { ...replay, shot } } };
};
type LegacyBattleSnapshot = { readonly version: 1; readonly state: Omit<BattleSnapshot["state"], "build"> };
export const restoreBattle = (snapshot: BattleSnapshot | LegacyBattleSnapshot): BattleSession => {
  if ((snapshot.version !== 1 && snapshot.version !== 2) || snapshot.state.ruleSetVersion !== RULE_SET_VERSION) throw new Error("unsupported battle snapshot version");
  // Explicit migration of the pre-public v1 snapshot; never infer future simulation versions.
  const state = snapshot.version === 1 ? { ...snapshot.state, build: { ...LEGACY_CLIENT_BUILD, map: { id: snapshot.state.map.id, version: snapshot.state.map.version } } } : snapshot.state;
  if (!state.build || !compatibleMatch(state.build, state.map)) throw new Error("unsupported battle build version");
  const mask = applyOps(maskFromHeights(state.map.surface, state.map.height), state.terrainOps);
  return { ...state, mask, replay: state.replay ? { ...state.replay, shot: { ...state.replay.shot, mask } } : null };
};
