import { randomUUID } from "node:crypto";
import { createBattle, createMovement, moveBattle, movementSnapshot, nextTurn, type MovementState } from "@game/engine/multiplayer";
import { TEST_ARENA } from "@game/maps";
import { labInputSchema, type LabFrame, type LabOutput } from "@game/protocol/v2-lab";
import type { WebSocket, WebSocketServer } from "ws";

import { createLabSessions, type LabSession } from "./sessions.js";
/** localhost限定の移動試験。固定8席の割当順は手番ring順。 */
export const attachMovementLab = (wss: WebSocketServer) => {
  const initial = createBattle(Array.from({ length: 8 }, (_, i) => ({ playerId: `p${i + 1}`, teamId: `t${i % 2}` })), 42, TEST_ARENA);
  let roster = initial.roster, players = initial.players;
  const matchId = randomUUID(), sessions = createLabSessions();
  let eventSeq = 0, dirty = false;
  const begin = (now: number): MovementState => {
    const playerId = roster.turnRing[roster.cursor]!, player = players.find(p => p.playerId === playerId)!;
    return createMovement({ matchId, turnId: roster.turnId, ...player, facing: 1, startsAt: now, deadlineAt: now + 20000 }, ++eventSeq);
  };
  let movement = begin(Date.now());
  const send = (socket: WebSocket, message: LabOutput): void => {
    if (socket.readyState === socket.OPEN && socket.bufferedAmount < 65536) socket.send(JSON.stringify(message));
  };
  const frame = (): LabFrame => ({ type: "lab.frame", serverTime: Date.now(), eventSeq: movement.eventSeq,
    matchId, turnId: roster.turnId, actorId: movement.playerId, deadlineAt: movement.deadlineAt,
    players: players.map(p => ({ playerId: p.playerId, x: p.x, y: p.y, eliminated: roster.eliminated.includes(p.playerId) })),
    movement: movementSnapshot(movement, Date.now()) });
  const timer = setInterval(() => {
    if (Date.now() >= movement.deadlineAt) {
      roster = nextTurn(roster); movement = begin(Date.now()); dirty = true;
    }
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
        const order = [...roster.turnRing.slice(roster.cursor), ...roster.turnRing.slice(0, roster.cursor)];
        const joined = sessions.join(socket, order, message.token);
        if ("error" in joined) { send(socket, { type: "lab.error", reason: joined.error }); return; }
        session = joined.session; clearTimeout(handshake);
        send(socket, { type: "lab.welcome", playerId: session.playerId, token: joined.token }); send(socket, frame()); return;
      }
      if (!session) { send(socket, { type: "lab.error", reason: "join-required" }); return; }
      const reply = moveBattle(roster, players, initial.mask, movement, session.playerId, message, Date.now());
      const changed = reply.state !== movement;
      movement = reply.state; players = [...reply.players]; roster = reply.roster;
      eventSeq = movement.eventSeq; dirty ||= changed;
      send(socket, { type: "lab.ack", reason: reply.reason, snapshot: reply.snapshot });
    });
    socket.on("close", () => { clearTimeout(handshake); if (session) sessions.disconnect(session, socket); });
    socket.on("error", () => socket.close());
  });
  return { close: () => { clearInterval(timer); for (const session of sessions.values()) session.socket?.close(); } };
};
