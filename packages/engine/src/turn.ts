import type { ClientMessageOf, FinishReason, MatchResult, PassReason, Seat, ServerMessageOf } from "@game/protocol";
import { DAMAGE_MAX, initialWind, nextWind, simulateShot, validateMove, WIND_DELTA_MAX, WIND_MAX } from "@game/sim";
import { otherSeat, type Effect, type EngineState, type Step } from "./types.js";

// ターンの開始、射撃の解決、パス、決着。engine.ts から呼ばれる純関数。

const rollInt = (rng: () => number, maxInclusive: number): number => Math.min(maxInclusive, Math.floor(rng() * (maxInclusive + 1)));

export const finish = (state: EngineState, winner: Seat | null, reason: FinishReason): Step => {
  const result: MatchResult = { winner, reason, turns: state.match.turnNumber, stats: state.stats };
  const next: EngineState = {
    ...state,
    match: { ...state.match, phase: "finished", deadlineAt: null, result },
    pausedRemainingMs: null,
    replayWakeAt: null,
    disconnectDeadlines: [null, null],
  };
  return { state: next, effects: [{ to: "all", message: { type: "match.finished", result } }], wakeAt: null };
};

/** 次のターンを始める。上限に達していれば HP で決着する */
export const startTurn = (state: EngineState, now: number): Step => {
  const turnNumber = state.match.turnNumber + 1;
  if (turnNumber > state.match.turnLimit) {
    const [a, b] = state.match.players;
    const winner: Seat | null = a.hp === b.hp ? null : a.hp > b.hp ? 0 : 1;
    return finish(state, winner, "turnLimit");
  }
  const seat = otherSeat(state.match.currentSeat);
  const rng = state.config.rng;
  const draw =
    turnNumber === 1
      ? { wind: initialWind(rollInt(rng, 2 * WIND_MAX)), gust: false }
      : nextWind(state.match.wind, {
          gust: rollInt(rng, 99),
          value: rollInt(rng, 2 * WIND_MAX),
          delta: rollInt(rng, 2 * WIND_DELTA_MAX),
        });
  // 手番側が切断中なら制限時間を止めたまま始める
  const paused = !state.match.players[seat].connected;
  const deadlineAt = now + state.config.turnMs;
  const message: ServerMessageOf<"turn.start"> = { type: "turn.start", turnNumber, seat, wind: draw.wind, deadlineAt };
  const next: EngineState = {
    ...state,
    match: { ...state.match, phase: "acting", turnNumber, currentSeat: seat, wind: draw.wind, deadlineAt: paused ? null : deadlineAt },
    fired: false,
    replayDone: [false, false],
    replayWakeAt: null,
    pausedRemainingMs: paused ? state.config.turnMs : null,
    gusts: [...state.gusts, draw.gust],
    lastTurnStart: message,
  };
  return { state: next, effects: [{ to: "all", message }], wakeAt: computeWakeAt(next) };
};

export const pass = (state: EngineState, reason: PassReason, now: number): Step => {
  const effect: Effect = { to: "all", message: { type: "turn.pass", turnNumber: state.match.turnNumber, reason } };
  // パスのターンには再生するものがないので、すぐ次のターンへ進む
  const started = startTurn(state, now);
  return { ...started, effects: [effect, ...started.effects] };
};

/** 射撃確定を解決する。移動の検証に失敗すればパスにする */
export const resolveFire = (state: EngineState, seat: Seat, fire: ClientMessageOf<"turn.fire">, now: number): Step => {
  const player = state.match.players[seat];
  if (!validateMove(state.mask, player.x, fire.x)) return pass(state, "invalidFire", now);
  const input = { seat, x: fire.x, facing: fire.facing, elevation: fire.elevation, power: fire.power, wind: state.match.wind.value };
  const [p0, p1] = state.match.players;
  const outcome = simulateShot(state.mask, [{ x: p0.x, hp: p0.hp }, { x: p1.x, hp: p1.hp }], input);
  const r = outcome.result;
  const opp = otherSeat(seat);
  const stat = state.stats[seat];
  const stats: EngineState["stats"] = seat === 0
    ? [{ damageDealt: stat.damageDealt + r.damage[opp], directHits: stat.directHits + (r.damage[opp] === DAMAGE_MAX ? 1 : 0) }, state.stats[1]]
    : [state.stats[0], { damageDealt: stat.damageDealt + r.damage[opp], directHits: stat.directHits + (r.damage[opp] === DAMAGE_MAX ? 1 : 0) }];
  const players: EngineState["match"]["players"] = [
    { ...p0, hp: r.hpAfter[0], x: r.xAfter[0], facing: seat === 0 ? fire.facing : p0.facing },
    { ...p1, hp: r.hpAfter[1], x: r.xAfter[1], facing: seat === 1 ? fire.facing : p1.facing },
  ];
  const finished: MatchResult | null = r.finished
    ? { winner: r.finished.winner, reason: r.finished.reason, turns: state.match.turnNumber, stats }
    : null;
  const message: ServerMessageOf<"turn.result"> = { type: "turn.result", turnNumber: state.match.turnNumber, shot: r, finished };
  const resolved: EngineState = {
    ...state,
    mask: outcome.mask,
    stats,
    fired: true,
    lastResult: message,
    match: {
      ...state.match,
      players,
      deadlineAt: null,
      terrainOps: r.terrainOp ? [...state.match.terrainOps, r.terrainOp] : state.match.terrainOps,
    },
  };
  if (finished) {
    const done = finish(resolved, finished.winner, finished.reason);
    return { ...done, effects: [{ to: "all", message }, ...done.effects] };
  }
  // 切断中の席は再生完了を待たない
  const replayDone: EngineState["replayDone"] = [!players[0].connected, !players[1].connected];
  const replaying: EngineState = {
    ...resolved,
    match: { ...resolved.match, phase: "replaying" },
    replayDone,
    replayWakeAt: now + state.config.replayWaitMs,
  };
  if (replayDone[0] && replayDone[1]) {
    const started = startTurn(replaying, now);
    return { ...started, effects: [{ to: "all", message }, ...started.effects] };
  }
  return { state: replaying, effects: [{ to: "all", message }], wakeAt: computeWakeAt(replaying) };
};

/** 次に tick が要る時刻。期限の猶予、再生の打ち切り、再接続の期限のうち最も早いもの */
export const computeWakeAt = (state: EngineState): number | null => {
  const candidates: number[] = [];
  if (state.match.phase === "acting" && state.match.deadlineAt !== null) candidates.push(state.match.deadlineAt + state.config.graceMs);
  if (state.match.phase === "replaying" && state.replayWakeAt !== null) candidates.push(state.replayWakeAt);
  for (const d of state.disconnectDeadlines) if (d !== null) candidates.push(d);
  return candidates.length === 0 ? null : Math.min(...candidates);
};
