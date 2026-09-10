import { buildMapSpec, type MapSpec } from "@game/maps";
import { HP_MAX } from "@game/sim";
import { createRoster, type RosterMember } from "./rules.js";

/** 開発用MapSpecから多人数の確定初期stateを作る。公開ロビーへの登録は別工程。 */
export const createBattle = (members: readonly RosterMember[], seed: number, spec: MapSpec) => {
  const roster = createRoster(members, seed);
  const { mask, spawns } = buildMapSpec(spec, members.length);
  const players = roster.members.map(member => ({ playerId: member.playerId, hp: HP_MAX,
    ...spawns[roster.turnRing.indexOf(member.playerId)]! }));
  return { roster, players, mask, map: { id: spec.id, version: spec.version, width: spec.width, height: spec.height, surface: [...spec.surface] } };
};
