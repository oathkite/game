import { LEGACY_CLIENT_BUILD } from "@game/protocol/build";
import { restoreBattle, serializeBattle, type BattleSnapshot } from "@game/engine/multiplayer";
import type { RoomReply, RoomState } from "./core.js";
export type RoomSnapshot = { readonly version: 1; readonly state: Omit<RoomState, "battle"> & { readonly battle: BattleSnapshot | null } };
export const serializeRoom = (state: RoomState): RoomSnapshot => ({ version: 1, state: { ...state, battle: state.battle ? serializeBattle(state.battle) : null } });
export const restoreRoom = (snapshot: RoomSnapshot): RoomState => {
  if (snapshot.version !== 1) throw new Error("unsupported room snapshot version");
  return { ...snapshot.state, reports: snapshot.state.reports ?? [], mode: snapshot.state.mode ?? "custom", region: snapshot.state.region ?? "asia", sessions: snapshot.state.sessions.map(s => ({ ...s, build: s.build ?? { ...LEGACY_CLIENT_BUILD }, role: s.role ?? "player" })), battle: snapshot.state.battle ? restoreBattle(snapshot.state.battle) : null };
};
/** Serialize commands per room. A rejected storage write never publishes an acknowledgement. */
export class RoomRuntime {
  private committed: RoomState;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(state: RoomState, private readonly save: (snapshot: RoomSnapshot) => Promise<void>) { this.committed = state; }
  get state(): RoomState { return this.committed; }
  update(reduce: (state: RoomState) => RoomReply): Promise<RoomReply> {
    const result = this.pending.then(async () => {
      const result = reduce(this.committed);
      if (result.state !== this.committed) {
        await this.save(serializeRoom(result.state));
        this.committed = result.state;
      }
      return result;
    });
    this.pending = result.catch(() => {});
    return result;
  }
}
