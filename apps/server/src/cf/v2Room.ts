import type { RoomMode, RoomRegion } from "@game/protocol/v2-rooms";
import { DurableObject } from "cloudflare:workers";
import { movementSnapshot } from "@game/engine/multiplayer";
import { createRoomState, disconnectRoom, nextRoomDeadline, reduceRoom, tickRoom, type RoomState } from "../rooms/core.js";
import { RoomRuntime, serializeRoom, type RoomSnapshot } from "../rooms/runtime.js";
import { restoreStoredRoom, UnrecoverableRoom } from "../rooms/restoreFailure.js";
import { roomFrame, lobbyFrame } from "../rooms/frame.js";
import { directoryKey, directoryLocation } from "./directoryPartitions.js";
import { RoomInvites } from "./roomInvites.js";
import { RoomSqlSnapshot } from "./roomSqlSnapshot.js";
import { DirectoryOutbox } from "./directoryOutbox.js";
import type { RoomDirectory } from "./v2Directory.js";
export type RoomEnv = { readonly ALLOCATION_LIMITER: RateLimit; readonly DIRECTORY: DurableObjectNamespace<RoomDirectory>; readonly ROOMS: DurableObjectNamespace<RoomObject>; readonly ALLOWED_ORIGINS: string };
type Attachment = { readonly connectionId: string; readonly acceptedAt: number; readonly joined: boolean; readonly windowAt: number; readonly count: number };
export class RoomObject extends DurableObject<RoomEnv> {
  private runtime: RoomRuntime | null = null;
  private publishedLobby: RoomState["lobby"] = null;
  private readonly invites: RoomInvites;
  private readonly snapshots: RoomSqlSnapshot;
  private readonly outbox: DirectoryOutbox;
  constructor(ctx: DurableObjectState, env: RoomEnv) {
    super(ctx, env);
    this.invites = new RoomInvites(ctx.storage.sql);
    this.outbox = new DirectoryOutbox(ctx.storage.sql);
    this.snapshots = new RoomSqlSnapshot(ctx.storage.sql);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS room_failure (id INTEGER PRIMARY KEY CHECK(id = 1), failed_at INTEGER NOT NULL, reason TEXT NOT NULL, outcome TEXT NOT NULL)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY CHECK(id = 1), snapshot TEXT NOT NULL)");
  }
  private load(roomId?: string, mode: RoomMode = "custom", region: RoomRegion = "asia"): RoomRuntime {
    if (this.ctx.storage.sql.exec("SELECT id FROM room_failure WHERE id = 1").toArray().length) throw new UnrecoverableRoom();
    if (this.runtime) return this.runtime;
    const stored = this.ctx.storage.sql.exec<{ snapshot: string }>("SELECT snapshot FROM room_state WHERE id = 1").toArray()[0];
    if (!stored && !roomId) throw new Error("missing room state");
    const state = stored ? restoreStoredRoom(this.snapshots.read(stored.snapshot)) : createRoomState(roomId!, mode, region);
    if (!stored) this.ctx.storage.sql.exec("INSERT INTO room_state VALUES (1, ?)", JSON.stringify(serializeRoom(state)));
    return this.runtime = new RoomRuntime(state, async snapshot => {
      await this.ctx.storage.transaction(async () => {
        this.snapshots.write(snapshot);
        this.queueSummary(snapshot.state);
        await this.schedule(snapshot.state);
      });
    });
  }
  async issueInvite(token: string): Promise<{ token: string; expiresAt: number } | null> {
    if (!this.probe()) return null;
    const runtime = await this.recover();
    if (!runtime?.state.sessions.some(session => session.token === token && session.role === "player" && session.connectionId)) return null;
    return this.invites.issue(Date.now());
  }
  probe(): boolean {
    return this.ctx.storage.sql.exec("SELECT id FROM room_state WHERE id = 1").toArray().length > 0;
  }
  async initialize(roomId: string, mode: RoomMode, region: RoomRegion): Promise<void> {
    const runtime = this.load(roomId, mode, region);
    if (runtime.state.mode !== mode || runtime.state.region !== region) throw new Error("room mode mismatch");
    await this.ctx.storage.sync();
  }
  private async schedule(state: Pick<RoomState, "sessions" | "reports"> & { readonly battle: RoomSnapshot["state"]["battle"] | RoomState["battle"] }): Promise<void> {
    // Stored battle deadlines share the same state, but the snapshot wraps its battle payload.
    const battle = state.battle && "version" in state.battle ? state.battle.state : state.battle;
    const deadline = nextRoomDeadline({ sessions: state.sessions, reports: state.reports, battle });
    const handshakes = this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN).map(ws => ws.deserializeAttachment() as Attachment).filter(a => a && !a.joined).map(a => a.acceptedAt + 10000);
    const next = [deadline, this.outbox.deadline(Date.now()), ...handshakes, ...(state.sessions.length ? [Date.now() + 300000] : [])].filter((n): n is number => n !== null);
    if (next.length) await this.ctx.storage.setAlarm(Math.max(Date.now() + 1, Math.min(...next)));
    else await this.ctx.storage.deleteAlarm();
  }
  private reconcile(state: RoomState): RoomState {
    const live = new Set(this.ctx.getWebSockets().map(ws => (ws.deserializeAttachment() as Attachment).connectionId));
    return state.sessions.reduce((next, session) => session.connectionId && !live.has(session.connectionId)
      ? disconnectRoom(next, session.connectionId, Date.now()) : next, state);
  }
  private send(ws: WebSocket, message: unknown): void { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); }
  private publish(state: RoomState): void {
    const frame = roomFrame(state, Date.now());
    const changedLobby = state.battle && state.lobby !== this.publishedLobby;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Attachment;
      if (state.sessions.some(s => s.connectionId === attachment.connectionId)) {
        if (changedLobby) this.send(ws, lobbyFrame(state));
        this.send(ws, frame);
      }
    }
    this.publishedLobby = state.lobby;
    this.queueSummary(state);
    this.flushSummary();
  }
  private flushSummary(): void {
    this.ctx.waitUntil(this.outbox.flush(Date.now(), async () => {
      await this.schedule(this.runtime?.state ?? { sessions: [], reports: [], battle: null });
      await this.ctx.storage.sync();
    }, summary => this.env.DIRECTORY.getByName(directoryKey(summary.region, summary.mode), { locationHint: directoryLocation(summary.region) }).update(summary))
      .catch(error => console.error("directory update failed", error)));
  }
  private queueSummary(state: Pick<RoomState, "roomId" | "mode" | "region" | "sessions" | "lobby">): void {
    if (!state.lobby) return;
    this.outbox.enqueue({ roomId: state.roomId, mode: state.mode, region: state.region,
      members: state.sessions.filter(s => s.role === "player").length,
      spectators: state.sessions.filter(s => s.role === "spectator").length,
      phase: state.lobby.phase, mapId: state.lobby.map.id }, Date.now());
  }
  private async recover(roomId?: string): Promise<RoomRuntime | null> {
    try { return this.load(roomId); }
    catch (error) {
      if (!(error instanceof UnrecoverableRoom)) throw error;
      this.ctx.storage.sql.exec("INSERT OR IGNORE INTO room_failure VALUES (1, ?, 'restore-failed', 'invalid')", Date.now());
      this.runtime = null;
      this.outbox.withdraw(Date.now());
      await this.schedule({ sessions: [], reports: [], battle: null });
      for (const ws of this.ctx.getWebSockets()) if (ws.readyState === WebSocket.OPEN) {
        this.send(ws, { type: "room.error", reason: "room-unrecoverable" });
        ws.close(1011, "room-unrecoverable");
      }
      this.flushSummary();
      return null;
    }
  }
  override async fetch(request: Request): Promise<Response> {
    const roomId = new URL(request.url).pathname.split("/").at(-1)!;
    if (!this.runtime && !this.ctx.storage.sql.exec("SELECT id FROM room_state WHERE id = 1").toArray().length) return new Response("room not found", { status: 404 });
    const runtime = await this.recover(roomId);
    if (!runtime) {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("room-unrecoverable", { status: 503 });
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      this.send(pair[1], { type: "room.error", reason: "room-unrecoverable" });
      pair[1].close(1011, "room-unrecoverable");
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    await runtime.update(state => ({ state: this.reconcile(state), reason: "reconcile" }));
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket required", { status: 426 });
    if (this.ctx.getWebSockets().length >= 16) return new Response("room capacity", { status: 429 });
    const pair = new WebSocketPair(), connectionId = crypto.randomUUID();
    pair[1].serializeAttachment({ connectionId, acceptedAt: Date.now(), joined: false, windowAt: Date.now(), count: 0 } satisfies Attachment);
    this.ctx.acceptWebSocket(pair[1], [connectionId]);
    await this.schedule(runtime.state);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  override async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const a = ws.deserializeAttachment() as Attachment | null, now = Date.now();
    if (!a) { ws.close(1011, "room-unrecoverable"); return; }
    const count = now - a.windowAt >= 1000 ? 1 : a.count + 1;
    if (typeof data !== "string" || data.length > 4096 || count > 30) { ws.close(1008, "rate limit"); return; }
    ws.serializeAttachment({ ...a, count, windowAt: now - a.windowAt >= 1000 ? now : a.windowAt });
    let raw: unknown; try { raw = JSON.parse(data); } catch { this.send(ws, { type: "room.error", reason: "invalid" }); return; }
    if (typeof raw === "object" && raw !== null && "invite" in raw && !this.invites.valid(raw.invite, now)) {
      this.send(ws, { type: "room.error", reason: "invalid-invite" }); ws.close(1008, "invalid-invite"); return;
    }
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    const runtime = await this.recover();
    if (!runtime) return;
    const result = await runtime.update(state => reduceRoom(this.reconcile(state), a.connectionId, raw, now, { playerId: `p${crypto.randomUUID()}`, token: crypto.randomUUID(), matchId: crypto.randomUUID(), seed }));
    if (result.welcome) {
      ws.serializeAttachment({ ...ws.deserializeAttachment(), joined: true });
      this.send(ws, { type: "room.welcome", playerId: result.welcome.playerId, token: result.welcome.token, role: result.welcome.role, generation: result.welcome.generation });
      if (result.state.battle) this.send(ws, lobbyFrame(result.state));
    }
    if (result.pong !== undefined) { this.send(ws, { type: "room.pong", nonce: result.pong }); return; }
    if (result.reported) { this.send(ws, { type: "room.reported", status: result.reported }); return; }
    if (result.ack && result.state.battle) this.send(ws, { type: "lab.ack", reason: result.reason, snapshot: movementSnapshot(result.state.battle.movement, now) });
    else if (!["accepted", "unchanged"].includes(result.reason)) this.send(ws, { type: "room.error", reason: result.reason });
    this.publish(result.state);
    if (result.close) ws.close(1000, "left");
  }
  override async webSocketClose(ws: WebSocket): Promise<void> {
    ws.close(1000, "disconnected");
    const runtime = await this.recover();
    if (!runtime) return;
    const a = ws.deserializeAttachment() as Attachment;
    const result = await runtime.update(state => ({ state: disconnectRoom(state, a.connectionId, Date.now()), reason: "disconnected" }));
    this.publish(result.state);
  }
  override async webSocketError(ws: WebSocket): Promise<void> { await this.webSocketClose(ws); }
  override async alarm(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment;
      if (a && !a.joined && Date.now() >= a.acceptedAt + 10000) ws.close(1008, "join required");
    }
    const runtime = await this.recover();
    if (!runtime) return;
    const result = await runtime.update(state => ({ state: tickRoom(this.reconcile(state), Date.now()), reason: "tick" }));
    await this.schedule(result.state); this.publish(result.state);
  }
}
