import { expect, it } from "vitest";
import { MULTIPLAYER_MAPS } from "@game/maps";
import { createBattle } from "../src/multiplayer/create";
import { resolveBattleShot } from "../src/multiplayer/combat";
for (const map of MULTIPLAYER_MAPS) it(`${map.id}: every initial seat can damage every other seat with cannon in still air`, () => {
  for (let count = 2; count <= 8; count++) {
    const members = Array.from({ length: count }, (_, i) => ({ playerId: `p${i}`, teamId: `t${i}` }));
    const state = createBattle(members, 42, map);
    for (const player of state.players) {
      const roster = { ...state.roster, cursor: state.roster.turnRing.indexOf(player.playerId) };
      for (const target of state.players.filter(candidate => candidate.playerId !== player.playerId)) {
        let reachable = false;
        for (const facing of [-1, 1] as const) {
          for (const elevation of [15, 30, 45, 60, 75]) {
            for (let power = 10; power <= 100; power += 5) {
              const shot = resolveBattleShot(roster, state.mask, state.players, { playerId: player.playerId, weapon: "cannon", wind: 0, facing, elevation, power });
              if (shot.impacts.some(impact => impact.damage.some(damage => damage.playerId === target.playerId && damage.amount > 0))) { reachable = true; break; }
            }
            if (reachable) break;
          }
          if (reachable) break;
        }
        expect(reachable, `${count} players, ${player.playerId} at x=${player.x} to ${target.playerId} at x=${target.x}`).toBe(true);
      }
    }
  }
}, 120000);
