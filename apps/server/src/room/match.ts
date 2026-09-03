import { computeWakeAt, createEngine, DEFAULT_ENGINE_TIMING, handle, setupMessage, type Effect, type EngineEvent } from "@game/engine";
import type { Outgoing, RoomRecord, ServerState } from "../state.js";
import { broadcast, broadcastState, connIdsOf, memberBySeat, send } from "./view.js";

// 部屋と対戦エンジンの橋渡し。エンジンの効果を接続 ID 宛てに変え、決着で部屋をリザルトに移す。

export type RoomStep = {
  readonly room: RoomRecord;
  readonly effects: readonly Outgoing[];
};

const route = (room: RoomRecord, effects: readonly Effect[]): Outgoing[] =>
  effects.flatMap((e) => {
    if (e.to === "all") return connIdsOf(room).map((c) => send(c, e.message));
    const connId = memberBySeat(room, e.to)?.connId;
    return connId ? [send(connId, e.message)] : [];
  });

/** オーナーの開始を受理し、Loading で対戦を作る。呼び出し側が開始条件を検査済みであること */
export const startMatch = (state: ServerState, room: RoomRecord, now: number): RoomStep => {
  const seat0 = memberBySeat(room, 0);
  const seat1 = memberBySeat(room, 1);
  if (!seat0 || !seat1) return { room, effects: [] };
  const engine = createEngine(
    { ...DEFAULT_ENGINE_TIMING, rng: state.config.rng },
    {
      roomCode: room.code,
      mapName: room.mapName,
      players: [
        { nickname: seat0.nickname, colors: seat0.colors },
        { nickname: seat1.nickname, colors: seat1.colors },
      ],
    },
  );
  const next: RoomRecord = { ...room, phase: "inMatch", engine, lastActivityAt: now, resultOpenedAt: null };
  const setup = setupMessage(engine);
  return { room: next, effects: [...broadcast(next, setup), ...broadcastState(next)] };
};

/** 対戦中の出来事をエンジンに渡す。決着したら部屋をリザルトへ移す（解散は呼び出し側が部屋を消す） */
export const dispatchEngine = (room: RoomRecord, event: EngineEvent, now: number): RoomStep => {
  if (!room.engine || room.phase !== "inMatch") return { room, effects: [] };
  const step = handle(room.engine, event, now);
  const effects = route(room, step.effects);
  if (step.state.match.phase !== "finished") {
    return { room: { ...room, engine: step.state }, effects };
  }
  if (step.state.match.result?.reason === "dissolved") {
    return { room: { ...room, engine: step.state }, effects };
  }
  const result: RoomRecord = {
    ...room,
    engine: step.state,
    phase: "result",
    resultOpenedAt: now,
    lastActivityAt: now,
    members: room.members.map((m) => ({ ...m, ready: false, closedResult: false })),
  };
  return { room: result, effects: [...effects, ...broadcastState(result)] };
};

/**
 * リザルトを閉じて募集中に戻す。全員が閉じたか、一定時間で呼ばれる。
 * 切断したまま戻らなかった参加者は外し、オーナーが抜けていれば入室が最も早い参加者に移す。
 * 参加者が誰もいなくなった場合は members が空になるので、呼び出し側が部屋を消す。
 */
export const reopenRoom = (room: RoomRecord, now: number): RoomStep => {
  const members = room.members.filter((m) => m.connId !== null).map((m) => ({ ...m, ready: false, closedResult: false }));
  const ownerStays = members.some((m) => m.seat === room.ownerSeat);
  const ownerSeat = ownerStays ? room.ownerSeat : ([...members].sort((a, b) => a.joinOrder - b.joinOrder)[0]?.seat ?? room.ownerSeat);
  const next: RoomRecord = { ...room, phase: "open", engine: null, resultOpenedAt: null, lastActivityAt: now, members, ownerSeat };
  return { room: next, effects: broadcastState(next) };
};

export const engineWakeAt = (room: RoomRecord): number | null => (room.engine && room.phase === "inMatch" ? computeWakeAt(room.engine) : null);
