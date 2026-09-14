import { expect, it, vi } from "vitest";
import { TEST_ARENA, MULTIPLAYER_MAPS } from "@game/maps";
import { createLobby, joinLobby, leaveLobby, editLobby, setLobbyConnection, startLobby } from "../src/multiplayer/lobby";
const profile = { nickname: "Kero", loadout: ["cannon", "digger"] as const };
const two = () => joinLobby(createLobby("room-a", "p1", profile, TEST_ARENA), "p2", profile);
const command = (room: ReturnType<typeof two>, type: string, extra = {}) => ({ version: 2, roomId: room.roomId, revision: room.revision, type, ...extra });
const ready = (room: ReturnType<typeof two>) => room.members.reduce((r, p) => editLobby(r, p.playerId, command(r, "room.ready", { ready: true })).room, room);

it("requires two assigned teams and every member ready at the current revision", () => {
  let room = two();
  expect(startLobby({ ...room, members: room.members.map(p => ({ ...p, teamId: null })) }, "p1", room.revision).reason).toBe("unassigned");
  room = editLobby(room, "p1", command(room, "room.assignTeam", { playerId: "p1", teamId: "t0" })).room;
  room = editLobby(room, "p2", command(room, "room.assignTeam", { playerId: "p2", teamId: "t1" })).room;
  expect(startLobby(room, "p1", room.revision).reason).toBe("not-ready");
  const revision = room.revision; room = ready(room);
  expect(room.revision).toBe(revision); // readiness does not invalidate the other person's acknowledgement
  expect(startLobby(room, "p2", room.revision).reason).toBe("not-owner");
  const started = startLobby(room, "p1", room.revision);
  expect(started.reason).toBe("started");
  expect(started.setup?.members).toHaveLength(2);
  expect(started.setup?.ruleSetVersion).toBe("keropod-v2.4-delay");
  expect(started.setup?.map).toEqual(TEST_ARENA);
  expect(started.setup?.map).not.toBe(TEST_ARENA);
  expect(editLobby(started.room, "p1", command(started.room, "room.assignTeam", { playerId: "p2", teamId: "t0" })).reason).toBe("locked");
  expect(startLobby(started.room, "p1", started.room.revision).reason).toBe("locked");
});
it("invalidates all readiness on loadout or membership change but not nickname edits", () => {
  let room = ready(two()); const old = room;
  room = editLobby(room, "p1", command(room, "room.profile", { nickname: "Kita" })).room;
  expect(room.members.every(p => p.ready)).toBe(true);
  room = editLobby(room, "p1", command(room, "room.loadout", { loadout: ["triple", "laser"] })).room;
  expect(room.members.every(p => !p.ready)).toBe(true);
  expect(room.revision).toBe(old.revision + 1);
  expect(old.members[0]!.loadout).toEqual(profile.loadout);
  expect(startLobby(room, "p1", old.revision).reason).toBe("stale-revision");
  expect(joinLobby(ready(room), "p3", profile).members.every(p => !p.ready)).toBe(true);
});
it("rejects cross-room, stale and impersonated changes and duplicate weapons", () => {
  const room = two();
  expect(editLobby(room, "outsider", command(room, "room.ready", { ready: true })).reason).toBe("not-member");
  expect(editLobby(room, "p2", command(room, "room.assignTeam", { playerId: "p1", teamId: "t1" })).reason).toBe("not-owner");
  expect(editLobby(room, "p1", command(room, "room.ready", { ready: true, roomId: "room-b" })).reason).toBe("wrong-room");
  expect(editLobby(room, "p1", command(room, "room.ready", { ready: true, revision: 1 })).reason).toBe("stale-revision");
  expect(editLobby(room, "p1", command(room, "room.loadout", { loadout: ["cannon", "cannon"] })).reason).toBe("invalid");
  expect(editLobby(room, "p1", command(room, "room.ready", { ready: true, playerId: "p2" })).reason).toBe("invalid");
});
it("disconnect clears ready and transfers ownership to the oldest connected member", () => {
  let room = joinLobby(ready(two()), "p3", profile);
  room = setLobbyConnection(ready(room), "p1", false);
  expect(room.ownerId).toBe("p2"); expect(room.members.every(p => !p.ready)).toBe(true);
  expect(editLobby(room, "p1", command(room, "room.ready", { ready: true })).reason).toBe("disconnected");
  room = leaveLobby(room, "p2"); expect(room.ownerId).toBe("p3");
  room = leaveLobby(room, "p3"); expect(room.ownerId).toBe(null);
  room = setLobbyConnection(room, "p1", true); expect(room.ownerId).toBe("p1");
});
it("caps at eight, preserves isolated room states and validates map capacity", () => {
  let room = createLobby("a", "p1", profile, TEST_ARENA);
  const other = createLobby("b", "p1", profile, TEST_ARENA);
  for (let i = 2; i <= 8; i++) room = joinLobby(room, `p${i}`, profile);
  expect(() => joinLobby(room, "p9", profile)).toThrow("full");
  expect(() => joinLobby(room, "p1", profile)).toThrow();
  expect(other.members).toHaveLength(1);
  let restricted = createLobby("r", "p1", profile, { ...TEST_ARENA, spawns: {} });
  restricted = joinLobby(restricted, "p2", profile);
  for (const [i, p] of restricted.members.entries()) restricted = editLobby(restricted, p.playerId, command(restricted, "room.assignTeam", { playerId: p.playerId, teamId: `t${i}` })).room;
  restricted = ready(restricted);
  expect(startLobby(restricted, "p1", restricted.revision).reason).toBe("unsupported-map");
});

it("starts every 2..8 player team partition without balancing asymmetric teams", () => {
  const partitions = (n: number, min = 1): number[][] => n === 0 ? [[]] : Array.from({ length: n - min + 1 }, (_, i) => i + min).flatMap(size => partitions(n - size, size).map(rest => [size, ...rest]));
  const formations = Array.from({ length: 7 }, (_, i) => partitions(i + 2)).flat().filter(p => p.length > 1);
  expect(formations).toHaveLength(58);
  for (const sizes of formations) {
    const teams = sizes.flatMap((size, i) => Array.from({ length: size }, () => `t${i}`));
    let room = createLobby("r", "p0", profile, TEST_ARENA);
    for (let i = 1; i < teams.length; i++) room = joinLobby(room, `p${i}`, profile);
    for (const [i, teamId] of teams.entries()) room = editLobby(room, "p0", command(room, "room.assignTeam", { playerId: `p${i}`, teamId })).room;
    room = ready(room);
    const started = startLobby(room, "p0", room.revision);
    expect(started.setup?.members.map(p => p.teamId)).toEqual(teams);
  }
});
it("does not start alone, disconnected, or with only one team", () => {
  const alone = createLobby("r", "p1", profile, TEST_ARENA);
  expect(startLobby(alone, "p1", 1).reason).toBe("not-enough-players");
  let room = two();
  for (const p of room.members) room = editLobby(room, "p1", command(room, "room.assignTeam", { playerId: p.playerId, teamId: "t0" })).room;
  room = ready(room); expect(startLobby(room, "p1", room.revision).reason).toBe("not-enough-teams");
  room = setLobbyConnection(room, "p2", false); expect(startLobby(room, "p1", room.revision).reason).toBe("disconnected");
});
it("uses the frozen loadout for the match instead of the lab's fixed cannon", async () => {
  const { createPreparedSession } = await import("../src/multiplayer/preparedSession");
  const { fireInSession } = await import("../src/multiplayer/session");
  let room = two();
  for (const [i, p] of room.members.entries()) {
    room = editLobby(room, p.playerId, command(room, "room.assignTeam", { playerId: p.playerId, teamId: `t${i}` })).room;
    room = editLobby(room, p.playerId, command(room, "room.loadout", { loadout: ["triple", "laser"] })).room;
  }
  room = ready(room);
  const setup = startLobby(room, "p1", room.revision).setup!;
  const session = createPreparedSession(setup, "match1", 42, 1000);
  expect(session.ruleSetVersion).toBe(setup.ruleSetVersion);
  expect(session.movement.startsAt).toBeGreaterThan(session.startedAt);
  expect(session.movement.deadlineAt - session.movement.startsAt).toBe(20000);
  expect(fireInSession(session, session.movement.playerId, { type: "turn.fire", version: 2, matchId: session.matchId,
    turnId: 1, commandId: "early", ackMoveSeq: 0, slot: 0, facing: 1, elevation: 45, power: 50 }, session.startedAt + 10).reason).toBe("outside-turn");
  const fired = fireInSession(session, session.movement.playerId, { type: "turn.fire", version: 2, matchId: session.matchId,
    turnId: 1, commandId: "f1", ackMoveSeq: 0, slot: 0, facing: 1, elevation: 45, power: 50 }, session.movement.startsAt);
  expect(fired.reason).toBe("accepted");
  expect(fired.state.replay?.shot.weapon).toBe("triple");
  expect(fired.state.replay?.shot.paths).toHaveLength(3);
  expect(session.loadouts[session.movement.playerId]).toEqual(["triple", "laser"]);
  expect(session.loadouts[session.movement.playerId]).not.toBe(setup.members[0]!.loadout);
});

it("allows only the owner to select a registered map and clears every ready state", () => {
  const room = ready(two()), change = command(room, "room.map", { mapId: "reed-hills" });
  expect(editLobby(room, "p2", change).reason).toBe("not-owner");
  expect(editLobby(room, "p1", { ...change, mapId: "unknown" }).reason).toBe("unsupported-map");
  const next = editLobby(room, "p1", change).room;
  expect(next.map.id).toBe("reed-hills");
  expect(next.map.width).toBe(350);
  expect(next.revision).toBe(room.revision + 1);
  expect(next.members.every(p => !p.ready)).toBe(true);
  expect(editLobby(next, "p1", change).reason).toBe("stale-revision");
});

it("keeps validated custom colors through match preparation and accepts legacy profiles", () => {
  const colors = { primary: "purple", secondary: "orange" } as const;
  let room = joinLobby(createLobby("color-room", "p1", { ...profile, colors }, TEST_ARENA), "p2", profile);
  room = editLobby(room, "p1", command(room, "room.assignTeam", { playerId:"p1", teamId:"t0" })).room;
  room = editLobby(room, "p2", command(room, "room.assignTeam", { playerId:"p2", teamId:"t1" })).room;
  const prepared = startLobby(ready(room), "p1", room.revision);
  expect(prepared.setup?.members[0]?.colors).toEqual(colors);
  expect(prepared.setup?.members[1]?.colors).toBeUndefined();
  expect(() => createLobby("bad", "p1", { ...profile, colors: { primary:"invalid", secondary:"red" } as never }, TEST_ARENA)).toThrow();
});
it("lets a custom-room owner start once guests are ready", () => {
  let room = two();
  room = editLobby(room, "p1", command(room, "room.assignTeam", { playerId: "p1", teamId: "t0" })).room;
  room = editLobby(room, "p2", command(room, "room.assignTeam", { playerId: "p2", teamId: "t1" })).room;
  expect(startLobby(room, "p1", room.revision, false).reason).toBe("not-ready");
  room = editLobby(room, "p2", command(room, "room.ready", { ready: true })).room;
  expect(startLobby(room, "p1", room.revision, false).reason).toBe("started");
  expect(startLobby(room, "p1", room.revision).reason).toBe("not-ready");
});

it("resolves random maps once at start and preserves the random setting", () => {
  let room = two();
  room = editLobby(room,"p1",command(room,"room.assignTeam",{playerId:"p1",teamId:"t0"})).room;
  room = editLobby(room,"p2",command(room,"room.assignTeam",{playerId:"p2",teamId:"t1"})).room;
  expect(editLobby(room,"p2",command(room,"room.map",{mapId:"random"})).reason).toBe("not-owner");
  room = ready(editLobby(room,"p1",command(room,"room.map",{mapId:"random"})).room);
  const random = vi.spyOn(Math,"random");
  try {
    MULTIPLAYER_MAPS.forEach((map,index) => {
      random.mockReturnValue((index+.5)/MULTIPLAYER_MAPS.length);
      const started = startLobby(room,"p1",room.revision);
      expect(started.setup?.map.id).toBe(map.id);
      expect(started.room.map).toEqual(started.setup?.map);
      expect(started.room.randomMap).toBe(true);
    });
  } finally { random.mockRestore(); }
  const fixed = editLobby(room,"p1",command(room,"room.map",{mapId:MULTIPLAYER_MAPS[0]!.id}));
  expect(fixed.room.randomMap).toBe(false);
});

it("assigns an unused team on creation and joining without changing existing teams", () => {
  let room = createLobby("auto", "p0", profile, TEST_ARENA);
  expect(room.members[0]!.teamId).toBe("t0");
  for (let i = 1; i < 8; i++) room = joinLobby(room, `p${i}`, profile);
  expect(room.members.map(p => p.teamId)).toEqual(Array.from({ length: 8 }, (_, i) => `t${i}`));
  room = leaveLobby(room, "p3");
  const before = room.members;
  room = joinLobby(room, "new", profile);
  expect(room.members.at(-1)!.teamId).toBe("t3");
  expect(room.members.slice(0, -1).map(p => p.teamId)).toEqual(before.map(p => p.teamId));
});

it("freezes the room turn limit into the prepared session", async () => {
  const { createPreparedSession } = await import("../src/multiplayer/preparedSession");
  const room = ready({ ...two(), turnLimit: 7 });
  const started = startLobby(room, "p1", room.revision);
  expect(started.setup?.turnLimit).toBe(7);
  expect(createPreparedSession(started.setup!, "match", 42, 1000).turnLimit).toBe(7);
});
