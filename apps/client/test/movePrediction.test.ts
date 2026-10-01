import { describe, expect, it } from "vitest";
import { createMovement, handleMove, movementSnapshot, type MovementState } from "@game/engine/multiplayer";
import { MULTIPLAYER_MAPS } from "@game/maps";
import { labFrameSchema } from "@game/protocol/v2-lab";
import type { MoveSnapshot } from "@game/protocol/v2";
import { applyOps, buildInitialTerrain, spawnPos, walk } from "@game/sim";
import { acknowledge, createMovePredictor, EMPTY_PREDICTION, predictedPose, requestFire, requestMove, syncTurn, type Prediction } from "../src/networkLab/movePrediction";

const flat = { id: "flat", version: 1, width: 500, height: 225, surface: Array(500).fill(150) };
const mask = buildInitialTerrain(flat);
const start = (x = 100, playerId = "p1", turnId = 1) => createMovement({ matchId: "m", turnId, playerId, x, y: 150, facing: 1, startsAt: 0, deadlineAt: 20000 });
const snapshot = (state: MovementState, patch: Partial<MoveSnapshot> = {}): MoveSnapshot => ({ ...movementSnapshot(state, 0), ...patch });
const poseOf = (state: MovementState) => ({ x: state.x, y: state.y, facing: state.facing, stepsLeft: state.stepsLeft, eliminated: state.eliminated });
const command = (moveSeq: number, direction: -1 | 1, turnId = 1) => ({ version: 2, type: "move.command", matchId: "m", turnId, commandId: `c${turnId}-${moveSeq}`, moveSeq, direction, steps: 1 });
/** 自分の手番を始めて、now の時刻に 1 歩ずつ要求する。返すのは予測と送った moveSeq */
const own = (state = start()): Prediction => syncTurn(EMPTY_PREDICTION, snapshot(state), true, 0);
const step = (p: Prediction, direction: -1 | 1, now: number) => {
  const request = requestMove(p, mask, direction, now);
  if (!request) throw new Error(`refused at ${now}`);
  return request;
};

describe("parity with the server's handleMove", () => {
  // 送った命令はすぐサーバーで処理し、ack は 3 命令ぶん遅れて届く（往復 300 ms）。予測は常にサーバーの位置と一致する
  it("predicts every step the server takes on every multiplayer map, including walls, falls and the end of the budget", () => {
    let checked = 0;
    const seen = new Set<string>();
    for (const map of MULTIPLAYER_MAPS) {
      const terrain = buildInitialTerrain(map);
      for (let x0 = 2; x0 < terrain.width - 2; x0 += 9) for (const direction of [-1, 1] as const) {
        const spawn = spawnPos(terrain, x0);
        if (spawn.y >= terrain.height) continue;
        let server = createMovement({ matchId: "m", turnId: 1, playerId: "p1", ...spawn, facing: 1, startsAt: 0, deadlineAt: 20000 });
        let client = syncTurn(EMPTY_PREDICTION, movementSnapshot(server, 0), true, 0);
        const inFlight: { reason: string; snapshot: MoveSnapshot | null }[] = [];
        for (let i = 0; i < 36; i++) {
          const now = i * 100, request = requestMove(client, terrain, direction, now);
          if (request) {
            client = request.prediction;
            const reply = handleMove(server, terrain, "p1", command(request.command.moveSeq, direction), now + 40);
            expect(reply.reason).toBe("accepted");
            server = reply.state; inFlight.push(reply);
            if (reply.state.stoppedByFall) seen.add("fell");
            if (reply.state.eliminated) seen.add("ring-out");
          } else {
            // 予測が送らない歩は、サーバーに送っても動かない（壁、歩数切れ、奈落の後）
            const probe = handleMove(server, terrain, "p1", command(server.ackMoveSeq + 1, direction), now + 40);
            expect([probe.state.x, probe.state.y]).toEqual([server.x, server.y]);
            seen.add(probe.reason);
          }
          if (inFlight.length > 3) { const reply = inFlight.shift()!; client = acknowledge(client, reply.reason, reply.snapshot); }
          expect(predictedPose(client, terrain)).toEqual(poseOf(server));
          checked++;
        }
        for (const reply of inFlight) client = acknowledge(client, reply.reason, reply.snapshot);
        expect(predictedPose(client, terrain)).toEqual(poseOf(server));
        expect(client.sent).toEqual([]);
        expect(client.recorded).toEqual([]);
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect([...seen].sort()).toEqual(["blocked", "fell", "no-budget", "ring-out", "stopped"]);
  });
});

describe("sending", () => {
  it("never sends faster than the server's budget of 10 steps a second with a burst of 2", () => {
    const a = step(own(), 1, 1000), b = step(a.prediction, 1, 1010);
    expect([a.command.moveSeq, b.command.moveSeq]).toEqual([1, 2]);
    expect(requestMove(b.prediction, mask, 1, 1020)).toBeNull();
    expect(requestMove(b.prediction, mask, 1, 1099)).toBeNull();
    expect(requestMove(b.prediction, mask, 1, 1101)?.command.moveSeq).toBe(3);
    // 押し続けの 100 ms ごとの送信は、毎回受け付ける
    let p = own();
    for (let i = 0; i < 30; i++) p = step(p, 1, i * 100).prediction;
    expect(predictedPose(p, mask)).toMatchObject({ x: 130, stepsLeft: 0 });
    expect(requestMove(p, mask, 1, 3000)).toBeNull();
  });

  it("does not send a step into a wall or off the edge, and keeps the facing the server keeps", () => {
    const edge = own(start(0));
    expect(requestMove(edge, mask, -1, 0)).toBeNull();
    expect(predictedPose(edge, mask)).toMatchObject({ x: 0, facing: 1 });
  });

  it("refuses to move or fire outside the player's own acting turn", () => {
    const other = syncTurn(EMPTY_PREDICTION, snapshot(start(100, "p2")), false, 0);
    expect(requestMove(other, mask, 1, 0)).toBeNull();
    expect(requestFire(other, mask)).toBeNull();
    expect(predictedPose(other, mask)).toBeNull();
  });
});

describe("reconciling with the server", () => {
  it("drops a step the server recorded without moving and replays the rest from the server's position", () => {
    const one = step(own(), 1, 0), two = step(one.prediction, 1, 100);
    expect(predictedPose(two.prediction, mask)!.x).toBe(102);
    // 1 歩目は受信が詰まって rate-limited。サーバーは記録したので ackMoveSeq は進むが、位置は動かない
    let p = acknowledge(two.prediction, "rate-limited", snapshot(start(), { ackMoveSeq: 1, eventSeq: 1 }));
    expect(predictedPose(p, mask)).toMatchObject({ x: 101, stepsLeft: 29 });
    p = acknowledge(p, "accepted", snapshot(start(), { x: 101, ackMoveSeq: 2, stepsLeft: 29, eventSeq: 2 }));
    expect(predictedPose(p, mask)).toMatchObject({ x: 101, stepsLeft: 29 });
    expect(step(p, 1, 300).command.moveSeq).toBe(3);
  });

  it("starts over from the server's position after a rejection the server does not record", () => {
    let p = own();
    for (let i = 0; i < 3; i++) p = step(p, 1, i * 100).prediction;
    // 1 歩目が手番の外で拒否された。2、3 歩目は sync-required で返ってくるが、やり直した後の命令を消さない
    p = acknowledge(p, "outside-turn", snapshot(start()));
    expect(predictedPose(p, mask)!.x).toBe(100);
    const again = step(p, 1, 300);
    expect(again.command.moveSeq).toBe(1);
    p = acknowledge(again.prediction, "sync-required", snapshot(start()));
    p = acknowledge(p, "sync-required", snapshot(start()));
    expect(predictedPose(p, mask)!.x).toBe(101);
    p = acknowledge(p, "accepted", snapshot(start(), { x: 101, ackMoveSeq: 1, stepsLeft: 29, eventSeq: 1 }));
    expect(predictedPose(p, mask)!.x).toBe(101);
    expect(p.sent).toEqual([]);
  });

  it("keeps a recorded step that only the next turn's snapshot answered until the turn ends, and ignores an older snapshot", () => {
    const p = step(own(), 1, 0).prediction;
    // 奈落へ落ちた歩などで手番が終わると、サーバーの ack は次の手番の snapshot を返す。手番の終わりの frame まで予測の位置に留める
    const ended = acknowledge(p, "accepted", snapshot(start(300, "p2", 2)));
    expect(predictedPose(ended, mask)!.x).toBe(101);
    expect(ended.sent).toEqual([]);
    expect(predictedPose(syncTurn(ended, snapshot(start(300, "p2", 2)), false, 100), mask)).toBeNull();
    const older = syncTurn(acknowledge(p, "accepted", snapshot(start(), { x: 101, ackMoveSeq: 1, stepsLeft: 29 })), snapshot(start()), true, 100);
    expect(predictedPose(older, mask)!.x).toBe(101);
    expect(older.recorded).toEqual([]);
  });

  it("starts over on a new turn and ignores the acknowledgements of the old one", () => {
    let p = own();
    p = step(p, 1, 0).prediction;
    p = requestFire(p, mask)!.prediction;
    p = syncTurn(p, snapshot(start(300, "p2", 2)), false, 100);
    expect(predictedPose(p, mask)).toBeNull();
    p = syncTurn(p, snapshot(start(105, "p1", 3)), true, 200);
    p = acknowledge(p, "wrong-turn", snapshot(start(105, "p1", 3)));
    p = acknowledge(p, "wrong-turn", snapshot(start(105, "p1", 3)));
    expect(predictedPose(p, mask)).toMatchObject({ x: 105, stepsLeft: 30 });
    expect(step(p, -1, 300).command).toEqual({ matchId: "m", turnId: 3, moveSeq: 1 });
    expect(requestFire(p, mask)).not.toBeNull();
  });
});

describe("firing", () => {
  it("stamps the shot with the last sent move and the predicted facing, and blocks moving until the result", () => {
    const left = step(own(), -1, 0);
    const fired = requestFire(left.prediction, mask)!;
    expect(fired.shot).toEqual({ matchId: "m", turnId: 1, ackMoveSeq: 1, facing: -1 });
    expect(requestMove(fired.prediction, mask, -1, 200)).toBeNull();
    expect(requestFire(fired.prediction, mask)).toBeNull();
    let p = acknowledge(fired.prediction, "accepted", snapshot(start(), { x: 99, facing: -1, ackMoveSeq: 1, stepsLeft: 29 }));
    expect(requestMove(p, mask, -1, 200)).toBeNull();
    // 発射が拒否されたら、もう一度動いて撃てる
    p = acknowledge(p, "move-sync-required", snapshot(start(), { x: 99, facing: -1, ackMoveSeq: 1, stepsLeft: 29 }));
    expect(requestMove(p, mask, -1, 200)?.command.moveSeq).toBe(2);
    expect(requestFire(p, mask)?.shot.ackMoveSeq).toBe(1);
  });

  it("keeps the shot's result when the moves before it are rejected", () => {
    let p = step(own(), 1, 0).prediction;
    p = step(p, 1, 100).prediction;
    p = requestFire(p, mask)!.prediction;
    p = acknowledge(p, "outside-turn", snapshot(start()));
    p = acknowledge(p, "sync-required", snapshot(start()));
    expect(requestFire(p, mask)).toBeNull();
    p = acknowledge(p, "move-sync-required", snapshot(start()));
    expect(requestFire(p, mask)?.shot.ackMoveSeq).toBe(0);
  });
});

describe("createMovePredictor", () => {
  const player = { playerId: "p1", x: 100, y: 150, hp: 100, teamId: "t0", eliminated: false };
  const frame = labFrameSchema.parse({ type: "lab.frame", build: { protocol: 2, sim: "keropod-sim-v2.1", assets: "keropod-world-v1", rules: "keropod-v2.1", map: { id: "flat", version: 1 } }, wind: 0, map: flat, serverTime: 0, eventSeq: 1, matchId: "m", turnId: 1, actorId: "p1", deadlineAt: 20000,
    players: [player, { ...player, playerId: "p2", x: 300, teamId: "t1" }], movement: snapshot(start()), phase: "acting", result: { type: "ongoing" }, terrainOps: [{ cx: 106, cy: 150, radius: 6 }], replay: null });

  it("predicts on the frame's terrain only during the player's own acting turn", () => {
    const predictor = createMovePredictor();
    predictor.frame(frame, "p2", 0);
    expect(predictor.move(1, 0)).toBeNull();
    predictor.frame(frame, "p1", 0);
    expect(predictor.move(1, 0)).toEqual({ matchId: "m", turnId: 1, moveSeq: 1 });
    const carved = walk(applyOps(buildInitialTerrain(flat), frame.terrainOps), { x: 100, y: 150 }, 1, 1);
    expect(carved.y).not.toBe(150);
    expect(predictor.pose()).toMatchObject({ x: carved.x, y: carved.y, facing: 1, stepsLeft: 29 });
    predictor.ack("accepted", snapshot(start(), { x: carved.x, y: carved.y, ackMoveSeq: 1, stepsLeft: 29 }));
    expect(predictor.fire()).toEqual({ matchId: "m", turnId: 1, ackMoveSeq: 1, facing: 1 });
    predictor.frame({ ...frame, phase: "replaying" }, "p1", 100);
    expect(predictor.pose()).toBeNull();
  });
});
