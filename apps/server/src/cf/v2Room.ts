import type { RoomMode, RoomRegion } from "@game/protocol/v2-rooms";
import { DurableObject } from "cloudflare:workers";
import { movementSnapshot } from "@game/engine/multiplayer";
import { createRoomState, disconnectRoom, nextRoomDeadline, reduceRoom, tickRoom, type RoomState } from "../rooms/core.js";
import { RoomRuntime, restoreRoom, serializeRoom, type RoomSnapshot } from "../rooms/runtime.js";
import { roomFrame, lobbyFrame } from "../rooms/frame.js";
import type { RoomDirectory } from "./v2Directory.js";
export type RoomEnv = { readonly ALLOCATION_LIMITER: RateLimit; readonly DIRECTORY: DurableObjectNamespace<RoomDirectory>; readonly ROOMS: DurableObjectNamespace<RoomObject>; readonly ALLOWED_ORIGINS: string };
type Attachment = { readonly connectionId: string; readonly acceptedAt: number; readonly joined: boolean; readonly windowAt: number; readonly count: number };
export class RoomObject extends DurableObject<RoomEnv> {
  private runtime: RoomRuntime | null = null;
  private summaryKey = "";
  private summaryAt = 0;
  constructor(ctx: DurableObjectState, env: RoomEnv) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY CHECK(id = 1), snapshot TEXT NOT NULL)");
  }
  private load(roomId?: string, mode: RoomMode = "custom", region: RoomRegion = "asia"): RoomRuntime {
    if (this.runtime) return this.runtime;
    const stored = this.ctx.storage.sql.exec<{ snapshot: string }>("SELECT snapshot FROM room_state WHERE id = 1").toArray()[0];
    if (!stored && !roomId) throw new Error("missing room state");
    const state = stored ? restoreRoom(JSON.parse(stored.snapshot)) : createRoomState(roomId!, mode, region);
    if (!stored) this.ctx.storage.sql.exec("INSERT INTO room_state VALUES (1, ?)", JSON.stringify(serializeRoom(state)));
    return this.runtime = new RoomRuntime(state, async snapshot => {
      await this.ctx.storage.transaction(async () => {
        this.ctx.storage.sql.exec("INSERT OR REPLACE INTO room_state VALUES (1, ?)", JSON.stringify(snapshot));
        await this.schedule(snapshot.state);
      });
    });
  }
  async initialize(roomId: string, mode: RoomMode, region: RoomRegion): Promise<void> {
    const runtime = this.load(roomId, mode, region);
    if (runtime.state.mode !== mode || runtime.state.region !== region) throw new Error("room mode mismatch");
    await this.ctx.storage.sync();
  }
  private async schedule(state: Pick<RoomState, "sessions"> & { readonly battle: RoomSnapshot["state"]["battle"] | RoomState["battle"] }): Promise<void> {
    // Stored battle deadlines share the same state, but the snapshot wraps its battle payload.
    const battle = state.battle && "version" in state.battle ? state.battle.state : state.battle;
    const deadline = nextRoomDeadline({ sessions: state.sessions, battle });
    const handshakes = this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN).map(ws => ws.deserializeAttachment() as Attachment).filter(a => !a.joined).map(a => a.acceptedAt + 10000);
    const next = [deadline, ...handshakes, ...(state.sessions.length ? [Date.now() + 300000] : [])].filter((n): n is number => n !== null);
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
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Attachment;
      if (state.sessions.some(s => s.connectionId === attachment.connectionId)) this.send(ws, frame);
    }
    if (!state.lobby) return;
    const summary = { roomId: state.roomId, mode: state.mode, region: state.region, members: state.sessions.filter(s => s.role === "player").length, spectators: state.sessions.filter(s => s.role === "spectator").length, phase: state.lobby?.phase ?? "waiting" as const, mapId: state.lobby?.map.id ?? "moss-valley" };
    const key = JSON.stringify(summary);
    if (key !== this.summaryKey || Date.now() - this.summaryAt >= 240000) {
      this.summaryAt = Math.max(Date.now(), this.summaryAt + 1);
      this.summaryKey = key;
      this.ctx.waitUntil(this.env.DIRECTORY.getByName("public").update({ ...summary, updatedAt: this.summaryAt }).catch(error => { this.summaryKey = ""; console.error("directory update failed", error); }));
    }
  }
  override async fetch(request: Request): Promise<Response> {
    const roomId = new URL(request.url).pathname.split("/").at(-1)!;
    if (!this.runtime && !this.ctx.storage.sql.exec("SELECT id FROM room_state WHERE id = 1").toArray().length) return new Response("room not found", { status: 404 });
    const runtime = this.load(roomId);
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
    const a = ws.deserializeAttachment() as Attachment, now = Date.now();
    const count = now - a.windowAt >= 1000 ? 1 : a.count + 1;
    if (typeof data !== "string" || data.length > 4096 || count > 30) { ws.close(1008, "rate limit"); return; }
    ws.serializeAttachment({ ...a, count, windowAt: now - a.windowAt >= 1000 ? now : a.windowAt });
    let raw: unknown; try { raw = JSON.parse(data); } catch { this.send(ws, { type: "room.error", reason: "invalid" }); return; }
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    const runtime = this.load();
    const result = await runtime.update(state => reduceRoom(this.reconcile(state), a.connectionId, raw, now, { playerId: `p${crypto.randomUUID()}`, token: crypto.randomUUID(), matchId: crypto.randomUUID(), seed }));
    if (result.welcome) {
      ws.serializeAttachment({ ...ws.deserializeAttachment(), joined: true });
      this.send(ws, { type: "room.welcome", playerId: result.welcome.playerId, token: result.welcome.token, role: result.welcome.role, generation: result.welcome.generation });
      if (result.state.battle) this.send(ws, lobbyFrame(result.state));
    }
    if (result.ack && result.state.battle) this.send(ws, { type: "lab.ack", reason: result.reason, snapshot: movementSnapshot(result.state.battle.movement, now) });
    else if (!["accepted", "unchanged"].includes(result.reason)) this.send(ws, { type: "room.error", reason: result.reason });
    this.publish(result.state);
    if (result.close) ws.close(1000, "left");
  }
  override async webSocketClose(ws: WebSocket): Promise<void> {
    const a = ws.deserializeAttachment() as Attachment;
    const result = await this.load().update(state => ({ state: disconnectRoom(state, a.connectionId, Date.now()), reason: "disconnected" }));
    this.publish(result.state);
  }
  override async webSocketError(ws: WebSocket): Promise<void> { await this.webSocketClose(ws); }
  override async alarm(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment;
      if (!a.joined && Date.now() >= a.acceptedAt + 10000) ws.close(1008, "join required");
    }
    const runtime = this.load();
    const result = await runtime.update(state => ({ state: tickRoom(this.reconcile(state), Date.now()), reason: "tick" }));
    await this.schedule(result.state); this.publish(result.state);
  }
}
