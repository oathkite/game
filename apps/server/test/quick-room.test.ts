import { expect, it } from "vitest";
import { createRoomState, reduceRoom } from "../src/rooms/core";
const profile = { nickname: "Quick", loadout: ["cannon", "laser"] };
const id = (n: number) => ({ playerId: `p${n}`, token: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, matchId: "quick-match", seed: n });
const join = (n: number, mode = "2v2") => ({ type: "room.quick", roomId: "ABCDEF", mode, region: "asia", profile });
it("starts 2v2 only with four ready players and fixes the symmetric teams", () => {
  let state = createRoomState("ABCDEF", "2v2", "asia");
  for (let n = 1; n <= 3; n++) state = reduceRoom(state, `c${n}`, join(n), 1000, id(n)).state;
  const command = (type: string, extra = {}) => ({ type, version: 2, roomId: "ABCDEF", revision: state.lobby!.revision, ...extra });
  expect(reduceRoom(state, "c1", command("room.start"), 1100, id(5)).reason).toBe("waiting-for-players");
  expect(reduceRoom(state, "c1", command("room.assignTeam", { playerId: "p1", teamId: "t2" }), 1100, id(5)).reason).toBe("fixed-mode");
  state = reduceRoom(state, "c4", join(4), 1200, id(4)).state;
  expect(state.lobby!.members.map(p => p.teamId)).toEqual(["t0", "t1", "t0", "t1"]);
  expect(reduceRoom(state, "c5", join(5), 1200, id(5)).reason).toBe("full");
  for (let n = 1; n <= 4; n++) state = reduceRoom(state, `c${n}`, command("room.ready", { ready: true }), 1300, id(6)).state;
  expect(state.battle?.phase).toBe("acting");
  expect(state.battle?.players).toHaveLength(4);
});
it("never mixes custom rooms, modes or regions", () => {
  const state = createRoomState("ABCDEF", "1v1", "asia");
  expect(reduceRoom(state, "c1", join(1), 1000, id(1)).reason).toBe("wrong-mode");
  expect(reduceRoom(state, "c1", { ...join(1, "1v1"), region: "europe" }, 1000, id(1)).reason).toBe("wrong-mode");
  expect(reduceRoom(state, "c1", { type: "room.create", profile }, 1000, id(1)).reason).toBe("wrong-mode");
});
