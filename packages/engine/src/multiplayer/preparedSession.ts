import { createBattle } from "./create.js";
import { RULE_SET_VERSION, type PreparedMatch } from "./lobby.js";
import { createBattleSession } from "./session.js";

/** Only a server-approved preparation snapshot enters the simulation. */
export const createPreparedSession = (setup: PreparedMatch, matchId: string, seed: number, now: number) => {
  if (setup.ruleSetVersion !== RULE_SET_VERSION) throw new Error("unsupported rule set");
  const battle = createBattle(setup.members, seed, setup.map);
  const loadouts = Object.fromEntries(setup.members.map(p => [p.playerId, p.loadout]));
  return createBattleSession(battle, matchId, now, loadouts);
};
