import { describe, expect, it } from "vitest";
import { createRoster, eliminatePlayers, nextTurn, outcome, type RosterMember } from "../src/multiplayer/rules";

const partitions = (n: number, min = 1): number[][] => n === 0 ? [[]] :
  Array.from({ length: n - min + 1 }, (_, i) => i + min).flatMap(size => partitions(n - size, size).map(rest => [size, ...rest]));
const formations = Array.from({ length: 7 }, (_, i) => partitions(i + 2)).flat().filter(p => p.length > 1);
const members = (sizes: number[]): RosterMember[] => sizes.flatMap((size, team) =>
  Array.from({ length: size }, (_, i) => ({ playerId: `p${team}-${i}`, teamId: `t${team}` })));

describe("multiplayer rules", () => {
  it("enumerates all 58 supported formations", () => expect(formations).toHaveLength(58));
  for (const sizes of formations) it(`cycles every survivor once: ${sizes.join(":")}`, () => {
    for (const seed of [0, 1, 42, 0xffffffff]) {
      const roster = members(sizes), state = createRoster(roster, seed);
      expect(createRoster([...roster].reverse(), seed)).toEqual(state);
      expect(new Set(state.turnRing)).toEqual(new Set(roster.map(p => p.playerId)));
      let current = state;
      const actors = [];
      for (let i = 0; i < roster.length; i++) {
        actors.push(current.turnRing[current.cursor]);
        current = nextTurn(current);
      }
      expect(new Set(actors).size).toBe(roster.length);
      expect(current.round).toBe(2); expect(current.cursor).toBe(0);
      expect(current.turnId).toBe(roster.length + 1);
      expect(outcome(state)).toEqual({ type: "ongoing" });
      const winner = roster[0]!.teamId;
      const resolved = eliminatePlayers(state, roster.filter(p => p.teamId !== winner).map(p => p.playerId));
      expect(outcome(resolved)).toEqual({ type: "win", teamId: winner });
      expect(outcome(eliminatePlayers(state, roster.map(p => p.playerId)))).toEqual({ type: "draw" });
      expect(state.eliminated).toEqual([]);
      for (let mask = 0; mask < 2 ** roster.length; mask++) {
        const removed = roster.filter((_, i) => mask & (1 << i)).map(p => p.playerId);
        const partial = eliminatePlayers(state, removed);
        const alive = roster.filter(p => !removed.includes(p.playerId));
        const teamCount = new Set(alive.map(p => p.teamId)).size;
        expect(outcome(partial).type).toBe(teamCount === 0 ? "draw" : teamCount === 1 ? "win" : "ongoing");
        if (teamCount < 2) continue;
        let turn = partial;
        const visited = [];
        for (let i = 0; i < alive.length; i++) {
          turn = nextTurn(turn); visited.push(turn.turnRing[turn.cursor]);
        }
        expect(new Set(visited)).toEqual(new Set(alive.map(p => p.playerId)));
      }
    }
  });
  it("interleaves teams and skips eliminated slots without granting extra actions", () => {
    const state = createRoster(members([2, 2]), 42);
    const teams = state.turnRing.map(id => state.members.find(p => p.playerId === id)!.teamId);
    expect(teams[0]).not.toBe(teams[1]); expect(teams[0]).toBe(teams[2]);
    const dead = state.turnRing[1]!;
    const resolved = eliminatePlayers(state, [dead, dead]);
    expect(resolved.eliminated).toEqual([dead]);
    expect(nextTurn(resolved).cursor).toBe(2);
    expect(nextTurn(nextTurn(nextTurn(resolved))).round).toBe(2);
  });
  it("does not advance after a terminal result", () => {
    const state = createRoster(members([1, 1]), 0);
    const done = eliminatePlayers(state, [state.turnRing[0]!]);
    expect(nextTurn(done)).toBe(done);
  });
  it("rejects invalid rosters, seeds and unknown eliminations", () => {
    for (const roster of [[], members([1]), members([8, 1]), members([2]), [{ playerId: "", teamId: "t" }, ...members([1, 1])], [members([1, 1])[0]!, members([1, 1])[0]!]]) {
      expect(() => createRoster(roster, 0)).toThrow();
    }
    for (const seed of [NaN, Infinity, -1, .5, 2 ** 32]) expect(() => createRoster(members([1, 1]), seed)).toThrow();
    expect(() => eliminatePlayers(createRoster(members([1, 1]), 0), ["unknown"])).toThrow();
  });
});
