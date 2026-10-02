import { describe, expect, it } from "vitest";
import { labFrameSchema } from "@game/protocol/v2-lab";
import { battleClock, clockKey, facingUpdates, sampleLive } from "../src/networkLab/liveView";

const player = { playerId: "p1", x: 20, y: 150, hp: 100, teamId: "t0", eliminated: false };
const frame = labFrameSchema.parse({ type: "lab.frame", build: { protocol: 2, sim: "keropod-sim-v2.1", assets: "keropod-world-v1", rules: "keropod-v2.1", map: { id: "test", version: 1 } }, wind: 0, map: { id: "test", version: 1, width: 500, height: 225, surface: Array(500).fill(150) }, serverTime: 1000, eventSeq: 2, matchId: "m", turnId: 1, actorId: "p1", deadlineAt: 21000,
  players: [player, { ...player, playerId: "p2", x: 300, teamId: "t1" }],
  movement: { version: 2, type: "move.snapshot", matchId: "m", turnId: 1, playerId: "p1", eventSeq: 2, serverTime: 1000, x: 20, y: 150, facing: 1, stepsLeft: 30, ackMoveSeq: 0, stoppedByFall: false, eliminated: false },
  phase: "acting", result: { type: "ongoing" }, terrainOps: [{ cx: 200, cy: 150, radius: 6 }], replay: null,
  delay: { readyAt: { p1: 0, p2: 0 }, clock: 0, round: 2, order: ["p1", "p2"], costs: {}, previous: {}, revealUntil: 1600 } });
const positions = [{ playerId: "p1", x: 20, y: 150 }, { playerId: "p2", x: 300.4, y: 150 }];

it("merges the buffered positions into the frame's players while acting", () => {
  const live = sampleLive(frame, 1000, positions, false);
  expect(live.players.map(p => [p.playerId, p.x, p.hp])).toEqual([["p1", 20, 100], ["p2", 300.4, 100]]);
  expect(live.presentation.terrainOps).toHaveLength(1);
  // 描画ループは props の frame ではなく、この表示を作った frame を使う
  expect(live.frame).toBe(frame);
  expect(sampleLive(frame, 1000, [positions[1]!], false).players.map(p => p.playerId)).toEqual(["p2"]);
});

it("keeps the same key while only the sub-second clock and remote tanks move", () => {
  const at = (serverNow: number, remoteX = 300.4) => clockKey(battleClock(frame, sampleLive(frame, serverNow, [positions[0]!, { ...positions[1]!, x: remoteX }], false), "p1"));
  expect(at(1700)).toBe(at(1900, 305.7));
  // 残り秒が変わる、手番順の演出が終わる、自機が動く、のどれでも描き直す
  expect(at(1999)).not.toBe(at(2000));
  expect(at(1599)).not.toBe(at(1600));
  expect(battleClock(frame, sampleLive(frame, 1599, positions, false), "p1")).toMatchObject({ revealed: false, seconds: 20 });
  expect(battleClock(frame, sampleLive(frame, 1600, positions, false), "p1")).toMatchObject({ revealed: true, own: { x: 20, y: 150 } });
  const moved = sampleLive(frame, 1700, [{ ...positions[0]!, x: 21 }, positions[1]!], false);
  expect(clockKey(battleClock(frame, moved, "p1"))).not.toBe(at(1700));
});

it("rounds the shown own position and counts the shown terrain", () => {
  const clock = battleClock(frame, sampleLive(frame, 1700, [{ playerId: "p1", x: 20.4, y: 150.6 }, positions[1]!], false), "p1");
  expect(clock).toMatchObject({ own: { x: 20, y: 151 }, terrain: 1, opening: false, returnSeconds: null });
  expect(battleClock(frame, sampleLive(frame, 1700, positions, false), "spectator").own).toBeNull();
});

it("counts down the opening tour and the return to the room", () => {
  const opening = { ...frame, opening: { startsAt: 0, endsAt: 1500, playerIds: ["p1", "p2"] } };
  expect(battleClock(opening, sampleLive(opening, 1499, positions, false), "p1").opening).toBe(true);
  expect(battleClock(opening, sampleLive(opening, 1500, positions, false), "p1").opening).toBe(false);
  const finished = { ...frame, phase: "finished" as const, returnStatus: { deadlineAt: 61000, readyIds: [] } };
  expect(battleClock(finished, sampleLive(finished, 1000, positions, false), "p1")).toMatchObject({ seconds: null, returnSeconds: 60 });
  expect(battleClock(finished, sampleLive(finished, 62000, positions, false), "p1").returnSeconds).toBe(0);
});

it("shows the predicted own move and redraws when its facing or remaining steps change", () => {
  const pose = { x: 21, y: 150, facing: 1 as const, stepsLeft: 29, eliminated: false };
  const live = sampleLive(frame, 1700, [{ playerId: "p1", x: 21, y: 150 }, positions[1]!], false, pose);
  expect(live.own).toBe(pose);
  const clock = battleClock(frame, live, "p1");
  expect(clock.move).toEqual({ facing: 1, stepsLeft: 29 });
  const turned = battleClock(frame, sampleLive(frame, 1700, [{ playerId: "p1", x: 21, y: 150 }, positions[1]!], false, { ...pose, facing: -1 }), "p1");
  expect(clockKey(turned)).not.toBe(clockKey(clock));
  expect(battleClock(frame, sampleLive(frame, 1700, positions, false), "p1").move).toBeNull();
});

describe("facingUpdates (design 30)", () => {
  const turn = (actorId: string, patch: Partial<typeof frame.movement> = {}) => ({ ...frame, actorId, movement: { ...frame.movement, playerId: actorId, ...patch } });
  const replaying = (playerId: string, facing: -1 | 1) => ({ ...turn(playerId), phase: "replaying" as const, replay: { shooter: { playerId, facing } } });

  it("keeps the facing shown before another player's turn until the server records a step", () => {
    // サーバーは手番の初めを右向きにする。歩を記録する前の右向きは、撃った向きを上書きしない
    expect(facingUpdates({ frame: turn("p2"), own: null, prepared: null }, "p1")).toEqual([]);
    expect(facingUpdates({ frame: turn("p2", { facing: -1, ackMoveSeq: 1 }), own: null, prepared: null }, "p1")).toEqual([["p2", -1]]);
    // 進めずに向きだけを変えた歩も記録される
    expect(facingUpdates({ frame: turn("p2", { facing: 1, ackMoveSeq: 1 }), own: null, prepared: null }, "p1")).toEqual([["p2", 1]]);
  });

  it("uses the predicted facing in the own turn, even before the server records a step", () => {
    const own = { x: 20, y: 150, facing: -1 as const, stepsLeft: 30, eliminated: false };
    expect(facingUpdates({ frame: turn("p1"), own, prepared: null }, "p1")).toEqual([["p1", -1]]);
  });

  it("shows the shot's facing during its replay", () => {
    expect(facingUpdates({ frame: replaying("p2", -1), own: null, prepared: null }, "p1")).toEqual([["p2", -1]]);
    // 自分の射撃の再生中は、次の手番に使う向きより撃った向きを出す
    expect(facingUpdates({ frame: replaying("p1", -1), own: null, prepared: 1 }, "p1")).toEqual([["p1", -1]]);
  });

  it("shows the facing for the next own turn on the own tank during another player's turn and replay", () => {
    expect(facingUpdates({ frame: turn("p2"), own: null, prepared: -1 }, "p1")).toEqual([["p1", -1]]);
    expect(facingUpdates({ frame: replaying("p2", 1), own: null, prepared: -1 }, "p1")).toEqual([["p2", 1], ["p1", -1]]);
  });
});
