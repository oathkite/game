import type { RoomMode, RoomRegion, RoomSummary, RoomPage, RoomListFilter } from "@game/protocol/v2-rooms";
import { createDirectoryTables, createRoomEntry, listRooms, quickRoom, roomExists, roomPage, updateRoomEntry } from "./directoryStore.js";
import { DurableObject } from "cloudflare:workers";
export type { RoomSummary } from "@game/protocol/v2-rooms";
// 期限と上限の中身は directoryStore.ts に置く。ここは各メソッドの入口で時計を 1 回だけ読み、sql とともに渡すアダプタに留める。
export class RoomDirectory extends DurableObject<{ DIRECTORY: DurableObjectNamespace<RoomDirectory> }> {
  constructor(ctx: DurableObjectState, env: { DIRECTORY: DurableObjectNamespace<RoomDirectory> }) {
    super(ctx, env);
    createDirectoryTables(ctx.storage.sql);
  }
  probe(): boolean { return true; }
  reserveCode(): string {
    let roomId: string;
    do { roomId = crypto.randomUUID().slice(0, 6).toUpperCase(); } while (this.ctx.storage.sql.exec("SELECT id FROM room_codes WHERE id = ?", roomId).toArray().length);
    this.ctx.storage.sql.exec("INSERT INTO room_codes VALUES (?)", roomId);
    return roomId;
  }
  allocate(mode: RoomMode = "custom", region: RoomRegion = "asia"): Promise<string> {
    return this.ctx.blockConcurrencyWhile(() => createRoomEntry(this.ctx.storage.sql, Date.now(), mode, region, () => this.publicCode()));
  }
  exists(roomId: string): boolean { return roomExists(this.ctx.storage.sql, Date.now(), roomId); }
  quick(mode: Exclude<RoomMode, "custom">, region: RoomRegion): Promise<string> {
    return this.ctx.blockConcurrencyWhile(() => quickRoom(this.ctx.storage.sql, Date.now(), mode, region, () => this.publicCode()));
  }
  update(summary: RoomSummary): void { updateRoomEntry(this.ctx.storage.sql, Date.now(), summary); }
  page(after: string, filter: RoomListFilter = {}): RoomPage { return roomPage(this.ctx.storage.sql, Date.now(), after, filter); }
  list(): readonly RoomSummary[] { return listRooms(this.ctx.storage.sql, Date.now()); }
  /** 部屋番号は全 Directory で重ならないよう、public の Directory から払い出す */
  private async publicCode(): Promise<string> { return await this.env.DIRECTORY.getByName("public").reserveCode(); }
}
