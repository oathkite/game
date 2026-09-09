import { randomUUID } from "node:crypto";
import { createBattle, createBattleSession, fireInSession, moveInSession, movementSnapshot, surrenderInSession, tickSession } from "@game/engine/multiplayer";
import { TEST_ARENA } from "@game/maps";
import { ONE } from "@game/sim";
import { labInputSchema, type LabFrame, type LabOutput } from "@game/protocol/v2-lab";
import type { WebSocket, WebSocketServer } from "ws";
import { createLabSessions, type LabSession } from "./sessions.js";

/** localhost限定の縦断試験。固定8席、固定loadout。 */
export const attachMovementLab = (wss: WebSocketServer) => {
  const members = Array.from({ length: 8 }, (_, i) => ({ playerId: `p${i + 1}`, teamId: `t${i % 2}` }));
  let seed = 42;
  const fresh = () => createBattleSession(createBattle(members, seed++, TEST_ARENA), randomUUID(), Date.now());
  let state = fresh(), dirty = false;
  const sessions = createLabSessions();
  const send = (socket: WebSocket, message: LabOutput): void => {
    if (socket.bufferedAmount >= 65536) { socket.close(1008, "slow connection"); return; }
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };
  const frame = (): LabFrame => ({ type: "lab.frame", serverTime: Date.now(), eventSeq: state.movement.eventSeq,
    matchId: state.matchId, turnId: state.roster.turnId, actorId: state.movement.playerId, deadlineAt: state.movement.deadlineAt,
    players: state.players.map(p => ({ ...p, teamId: members.find(m => m.playerId === p.playerId)!.teamId, eliminated: state.roster.eliminated.includes(p.playerId) })),
    movement: movementSnapshot(state.movement, Date.now()), phase: state.phase, result: state.result, terrainOps: [...state.terrainOps],
    replay: state.replay ? { startsAt: state.replay.startsAt, endsAt: state.replay.endsAt,
      paths: state.replay.shot.paths.map(p => p.points.filter((_, i) => i % 4 === 0 || i === p.points.length - 1).map(point => ({ x: point.x / ONE, y: point.y / ONE }))) } : null });
  const timer = setInterval(() => {
    const next = tickSession(state, Date.now()); dirty ||= next !== state; state = next;
    if (!dirty) return;
    dirty = false;
    const snapshot = frame();
    for (const session of sessions.values()) if (session.socket) send(session.socket, snapshot);
  }, 100);
  wss.on("connection", socket => {
    let session: LabSession | undefined;
    let windowAt = Date.now(), count = 0;
    const handshake = setTimeout(() => socket.close(1008, "join required"), 5000);
    socket.on("message", data => {
      if (Date.now() - windowAt >= 1000) { windowAt = Date.now(); count = 0; }
      if (++count > 30 || data.toString().length > 4096) { socket.close(1008, "rate limit"); return; }
      let raw: unknown;
      try { raw = JSON.parse(data.toString()); } catch { send(socket, { type: "lab.error", reason: "invalid-json" }); return; }
      const parsed = labInputSchema.safeParse(raw);
      if (!parsed.success) { send(socket, { type: "lab.error", reason: "invalid-message" }); return; }
      const message = parsed.data;
      if (message.type === "lab.join") {
        if (session) return;
        const order = [...state.roster.turnRing.slice(state.roster.cursor), ...state.roster.turnRing.slice(0, state.roster.cursor)];
        const joined = sessions.join(socket, order, message.token);
        if ("error" in joined) { send(socket, { type: "lab.error", reason: joined.error }); return; }
        session = joined.session; clearTimeout(handshake);
        send(socket, { type: "lab.welcome", playerId: session.playerId, token: joined.token }); send(socket, frame()); return;
      }
      if (!session) { send(socket, { type: "lab.error", reason: "join-required" }); return; }
      const before = state;
      if (message.type === "lab.rematch") {
        if (state.phase === "finished" && message.matchId === state.matchId) state = fresh();
      } else if (message.type === "lab.surrender") {
        if (message.matchId === state.matchId) state = surrenderInSession(state, session.playerId, Date.now());
      } else if (message.type === "turn.fire") {
        const reply = fireInSession(state, session.playerId, message, Date.now()); state = reply.state;
        send(socket, { type: "lab.ack", reason: reply.reason, snapshot: movementSnapshot(state.movement, Date.now()) });
      } else {
        const reply = moveInSession(state, session.playerId, message, Date.now()); state = reply.state;
        send(socket, { type: "lab.ack", reason: reply.reason, snapshot: reply.snapshot });
      }
      dirty ||= before !== state;
    });
    socket.on("close", () => { clearTimeout(handshake); if (session) sessions.disconnect(session, socket); });
    socket.on("error", () => socket.close());
  });
  return { close: () => { clearInterval(timer); for (const session of sessions.values()) session.socket?.close(); } };
};
