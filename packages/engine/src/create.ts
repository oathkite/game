import { getMap } from "@game/maps";
import type { MapName, PlayerState, Seat, ServerMessageOf, TankColors } from "@game/protocol";
import { HP_MAX } from "@game/sim";
import type { EngineConfig, EngineState } from "./types.js";

export type MatchPlayerSpec = {
  readonly nickname: string;
  readonly colors: TankColors;
};

export type CreateParams = {
  readonly roomCode: string;
  readonly mapName: MapName;
  readonly players: readonly [MatchPlayerSpec, MatchPlayerSpec];
};

const roll = (rng: () => number): boolean => rng() < 0.5;

/** 対戦を Loading 状態で作る。左右の配置と先攻は rng で決める */
export const createEngine = (config: EngineConfig, params: CreateParams): EngineState => {
  const map = getMap(params.mapName);
  const swap = roll(config.rng);
  const firstSeat: Seat = roll(config.rng) ? 1 : 0;
  const spawnOf = (seat: Seat): number => map.spawns[(seat === 0) !== swap ? 0 : 1];
  const player = (seat: Seat): PlayerState => ({
    seat,
    nickname: params.players[seat].nickname,
    colors: params.players[seat].colors,
    hp: HP_MAX,
    x: spawnOf(seat),
    // 対戦開始時は相手側を向く
    facing: spawnOf(seat) < spawnOf(seat === 0 ? 1 : 0) ? 1 : -1,
    connected: true,
  });
  return {
    config,
    match: {
      roomCode: params.roomCode,
      mapName: params.mapName,
      phase: "loading",
      turnNumber: 0,
      turnLimit: config.turnLimit,
      // 最初の startTurn で交代するので、先攻の相手を入れておく
      currentSeat: firstSeat === 0 ? 1 : 0,
      deadlineAt: null,
      wind: { value: 0 },
      players: [player(0), player(1)],
      terrainOps: [],
      result: null,
    },
    mask: map.build(),
    loaded: [false, false],
    replayDone: [false, false],
    fired: false,
    pausedRemainingMs: null,
    replayWakeAt: null,
    disconnectDeadlines: [null, null],
    gusts: [],
    stats: [
      { damageDealt: 0, directHits: 0 },
      { damageDealt: 0, directHits: 0 },
    ],
    lastResult: null,
    lastTurnStart: null,
  };
};

/** match.setup の内容。createEngine の直後に両席へ送る */
export const setupMessage = (state: EngineState): ServerMessageOf<"match.setup"> => {
  const [p0, p1] = state.match.players;
  const spec = (p: PlayerState) => ({ seat: p.seat, nickname: p.nickname, colors: p.colors, x: p.x });
  return {
    type: "match.setup",
    mapName: state.match.mapName,
    players: [spec(p0), spec(p1)],
    hp: HP_MAX,
    firstSeat: state.match.currentSeat === 0 ? 1 : 0,
    turnLimit: state.match.turnLimit,
  };
};
