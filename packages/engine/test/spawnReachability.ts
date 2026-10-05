import { setImmediate } from "node:timers/promises";
import { expect, it } from "vitest";
import { MULTIPLAYER_MAPS } from "@game/maps";
import { createBattle } from "../src/multiplayer/create";
import { resolveBattleShot } from "../src/multiplayer/combat";

// 全マップの全席の組を総当たりで撃つので重い（1 マップと 1 つの風で手元 3〜4.5 秒）。
// Vitest はファイルごとに並列に回すので、風ごとのファイル（spawnReachability-wind*.test.ts）から呼んで 3 つに分ける。
// マップごとに分けないのは、マップを足したときにファイルの足し忘れで検査が漏れないようにするため。
export const spawnReachabilityTests = (wind: number): void => {
  // Floating islands intentionally obstruct direct shots; their safe starts and complete matches are tested separately.
  for (const map of MULTIPLAYER_MAPS.filter(map => map.id !== "sky-islands")) it(`${map.id}: every initial seat can damage every other seat with cannon in wind ${wind}`, async () => {
    for (let count = 2; count <= 8; count++) {
      const members = Array.from({ length: count }, (_, i) => ({ playerId: `p${i}`, teamId: `t${i}` }));
      const state = createBattle(members, 42, map);
      for (const player of state.players) {
        const roster = { ...state.roster, cursor: state.roster.turnRing.indexOf(player.playerId) };
        for (const target of state.players.filter(candidate => candidate.playerId !== player.playerId)) {
          let reachable = false;
          for (const facing of [-1, 1] as const) {
            for (let elevation = 5; elevation <= 85; elevation += 5) {
              for (let power = 10; power <= 100; power += 1) {
                const shot = resolveBattleShot(roster, state.mask, state.players, { playerId: player.playerId, weapon: "cannon", wind, facing, elevation, power });
                if (shot.impacts.some(impact => impact.damage.some(damage => damage.playerId === target.playerId && damage.amount > 0))) { reachable = true; break; }
              }
              if (reachable) break;
            }
            if (reachable) break;
          }
          await setImmediate();
          expect(reachable, `${count} players, ${player.playerId} at x=${player.x} to ${target.playerId} at x=${target.x}`).toBe(true);
        }
      }
    }
  }, 120000);
};
