import { expect, it } from "vitest";
import { MULTIPLAYER_MAPS } from "@game/maps";
import { WEAPON_IDS, type Loadout } from "@game/protocol";
import { createBattle } from "../src/multiplayer/create";
import { createBattleSession, fireInSession, tickSession } from "../src/multiplayer/session";
import { restoreBattle, serializeBattle } from "../src/multiplayer/snapshot";

for (const map of MULTIPLAYER_MAPS) for (const count of [2, 3, 4, 5, 6, 7, 8]) {
  it(`${map.id}: ${count} players can use every weapon at low, medium and full power`, () => {
    const members = Array.from({ length: count }, (_, i) => ({ playerId: `p${i}`, teamId: `t${i % 2}` }));
    for (const weapon of WEAPON_IDS) for (const power of [1, 50, 100]) {
      const loadout: Loadout = [weapon, weapon === "cannon" ? "digger" : "cannon"];
      const initial = createBattleSession(createBattle(members, count, map), "matrix", 1000,
        Object.fromEntries(members.map(p => [p.playerId, loadout])), power);
      const actor = initial.movement.playerId;
      const shot = fireInSession(initial, actor, { version: 2, type: "turn.fire", matchId: "matrix", turnId: 1,
        commandId: "shot", ackMoveSeq: 0, slot: 0, facing: 1, elevation: 45, power }, 1100);
      expect(shot.reason).toBe("accepted");
      expect(shot.state.replay).not.toBeNull();
      expect(shot.state.mask.cells.length).toBe(map.width * map.height);
      for (const player of shot.state.players) {
        expect(Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(player.hp)).toBe(true);
        expect(player.hp).toBeGreaterThanOrEqual(0);
        expect(player.hp).toBeLessThanOrEqual(100);
      }
      expect(shot.state.replay!.endsAt).toBeGreaterThan(1100);
      const restored = restoreBattle(JSON.parse(JSON.stringify(serializeBattle(shot.state))));
      const next = tickSession(restored, restored.replay!.endsAt);
      expect(next.phase).not.toBe("replaying");
      expect(next).toEqual(tickSession(shot.state, shot.state.replay!.endsAt));
      expect(initial.terrainOps).toEqual([]);
      expect(initial.players.every(p => p.hp === 100)).toBe(true);
    }
  });
}
const partitions = (remaining: number, minimum = 1): number[][] => {
  if (!remaining) return [[]];
  return Array.from({ length: Math.max(0, remaining - minimum + 1) }, (_, i) => minimum + i)
    .flatMap(size => partitions(remaining - size, size).map(rest => [size, ...rest]));
};
it("every team-size partition up to eight players terminates within the round cap on both maps", () => {
  let checked = 0;
  for (const map of MULTIPLAYER_MAPS) for (let count = 2; count <= 8; count++) {
    for (const split of partitions(count).filter(teams => teams.length > 1)) {
      const members = split.flatMap((size, team) => Array.from({ length: size }, (_, seat) => ({ playerId: `${team}-${seat}`, teamId: `t${team}` })));
      let state = createBattleSession(createBattle(members, count, map), "partition", 0);
      const seen = new Set<string>();
      for (let turns = 0; state.phase !== "finished" && turns < count * 12 + 1; turns++) {
        seen.add(state.movement.playerId);
        state = tickSession(state, state.movement.deadlineAt);
      }
      expect(seen.size).toBe(count);
      expect(state.phase).toBe("finished");
      expect(state.result).toEqual({ type: "draw" });
      checked++;
    }
  }
  expect(checked).toBe(116);
});
