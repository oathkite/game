import type { EngineState } from "@game/engine";
import { DEFAULT_LOADOUT, parseLoadout, type Loadout } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { createServerState, type RoomRecord, type ServerConfig, type ServerState } from "./state.js";

// サーバーの状態を JSON に落とし、戻す。Durable Object のように実行単位がメモリから退避される環境で使う。
// 地形マスクの Uint8Array だけが JSON にならないので、base64 の文字列にする。

type MaskJson = { readonly width: number; readonly height: number; readonly cells: string };

type EngineJson = Omit<EngineState, "mask" | "config"> & { readonly mask: MaskJson };

type RoomJson = Omit<RoomRecord, "engine"> & { readonly engine: EngineJson | null };

export type ServerStateJson = {
  readonly rooms: readonly RoomJson[];
  readonly connections: readonly (readonly [string, ServerState["connections"] extends Map<string, infer V> ? V : never])[];
  readonly lobbyDirty: boolean;
  readonly lobbyNotifiedAt: number;
};

const encodeCells = (cells: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < cells.length; i += 0x8000) s += String.fromCharCode(...cells.subarray(i, i + 0x8000));
  return btoa(s);
};

const decodeCells = (text: string): Uint8Array => {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

const maskToJson = (m: TerrainMask): MaskJson => ({ width: m.width, height: m.height, cells: encodeCells(m.cells) });
const maskFromJson = (j: MaskJson): TerrainMask => ({ width: j.width, height: j.height, cells: decodeCells(j.cells) });

export const serializeState = (state: ServerState): ServerStateJson => ({
  rooms: [...state.rooms.values()].map((room) => {
    if (!room.engine) return { ...room, engine: null };
    const { config: _config, mask, ...rest } = room.engine;
    return { ...room, engine: { ...rest, mask: maskToJson(mask) } };
  }),
  connections: [...state.connections.entries()],
  lobbyDirty: state.lobbyDirty,
  lobbyNotifiedAt: state.lobbyNotifiedAt,
});

/** 武器（設計書 10）を持たない保存や、装備として成り立たない保存には既定の装備を補う。保存済みの部屋を壊さないため */
const withLoadout = <T extends { readonly loadout?: unknown }>(p: T): T & { readonly loadout: Loadout } => ({
  ...p,
  loadout: parseLoadout(p.loadout) ?? DEFAULT_LOADOUT,
});

const engineFromJson = (j: EngineJson, engineConfig: EngineState["config"]): EngineState => ({
  ...j,
  config: engineConfig,
  mask: maskFromJson(j.mask),
  match: { ...j.match, players: [withLoadout(j.match.players[0]), withLoadout(j.match.players[1])] },
});

/** 保存した状態を戻す。config（乱数と時間）は保存しないので、呼び出し側が渡す */
export const deserializeState = (json: ServerStateJson, config: ServerConfig, engineConfig: EngineState["config"]): ServerState => {
  const state = createServerState(config);
  for (const room of json.rooms) {
    const engine: EngineState | null = room.engine ? engineFromJson(room.engine, engineConfig) : null;
    state.rooms.set(room.code, { ...room, members: room.members.map(withLoadout), engine });
  }
  for (const [id, c] of json.connections) state.connections.set(id, c);
  state.lobbyDirty = json.lobbyDirty;
  state.lobbyNotifiedAt = json.lobbyNotifiedAt;
  return state;
};
