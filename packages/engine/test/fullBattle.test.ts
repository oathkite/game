import { expect, it } from "vitest";
import { MULTIPLAYER_MAPS } from "@game/maps";
import { WEAPON_IDS, type Loadout } from "@game/protocol";
import { createBattle } from "../src/multiplayer/create";
import { createBattleSession, fireInSession, tickSession, type BattleSession } from "../src/multiplayer/session";
import { serializeBattle, restoreBattle } from "../src/multiplayer/snapshot";
const restore = (state: BattleSession) => restoreBattle(JSON.parse(JSON.stringify(serializeBattle(state))));
for (const map of MULTIPLAYER_MAPS) it(`${map.id}: a complete eight-player mixed-weapon match survives restoration at every turn`, () => {
  const members = Array.from({ length: 8 }, (_, i) => ({ playerId: `p${i}`, teamId: `t${i % 3}` }));
  const loadouts = Object.fromEntries(members.map((member, i) => [member.playerId, [WEAPON_IDS[i]!, WEAPON_IDS[(i + 1) % 8]!] as Loadout]));
  let live = createBattleSession(createBattle(members, 123, map), "full-match", 0, loadouts, 123);
  let resumed = restore(live), shots = 0;
  while (live.phase !== "finished" && shots < 96) {
    expect(live.roster.eliminated).not.toContain(live.movement.playerId);
    const command = { version: 2, type: "turn.fire", matchId: live.matchId, turnId: live.roster.turnId,
      commandId: `shot-${shots}`, ackMoveSeq: live.movement.ackMoveSeq, slot: shots % 2,
      facing: live.movement.x < map.width / 2 ? 1 : -1, elevation: 25 + shots % 6 * 10, power: 15 + shots % 5 * 17 };
    const now = live.movement.startsAt + 300;
    const a = fireInSession(live, live.movement.playerId, command, now);
    const b = fireInSession(resumed, resumed.movement.playerId, command, now);
    expect(a.reason).toBe("accepted"); expect(b.reason).toBe("accepted");
    live = a.state; resumed = restore(b.state);
    expect(serializeBattle(resumed)).toEqual(serializeBattle(live));
    expect(Buffer.from(resumed.mask.cells).equals(Buffer.from(live.mask.cells))).toBe(true);
    expect(fireInSession(resumed, resumed.movement.playerId, command, now + 1).reason).toBe("duplicate");
    const endsAt = live.replay!.endsAt;
    live = tickSession(live, endsAt); resumed = restore(tickSession(resumed, endsAt));
    expect(serializeBattle(resumed)).toEqual(serializeBattle(live));
    shots++;
  }
  expect(shots).toBeGreaterThan(8);
  expect(live.phase).toBe("finished");
  expect(live.result.type).not.toBe("ongoing");
  expect(live.terrainOps.length).toBeGreaterThan(8);
  expect(restore(live).result).toEqual(live.result);
});
