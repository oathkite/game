import type { Seat } from "@game/protocol";
import { computeWakeAt, finish, pass, resolveFire, startTurn } from "./turn.js";
import { otherSeat, type Effect, type EngineEvent, type EngineState, type Step } from "./types.js";

// 出来事を 1 つ受け取り、新しい状態と送るべきメッセージを返す。

const noop = (state: EngineState): Step => ({ state, effects: [], wakeAt: computeWakeAt(state) });

const setPair = <T>(pair: readonly [T, T], seat: Seat, value: T): readonly [T, T] =>
  seat === 0 ? [value, pair[1]] : [pair[0], value];

const setConnected = (state: EngineState, seat: Seat, connected: boolean): EngineState => ({
  ...state,
  match: {
    ...state.match,
    players: [
      seat === 0 ? { ...state.match.players[0], connected } : state.match.players[0],
      seat === 1 ? { ...state.match.players[1], connected } : state.match.players[1],
    ],
  },
});

const onLoaded = (state: EngineState, seat: Seat, now: number): Step => {
  if (state.match.phase !== "loading") return noop(state);
  const loaded = setPair(state.loaded, seat, true);
  const next = { ...state, loaded };
  return loaded[0] && loaded[1] ? startTurn(next, now) : noop(next);
};

const onFire = (state: EngineState, event: Extract<EngineEvent, { type: "fire" }>, now: number): Step => {
  const { match } = state;
  if (match.phase !== "acting" || event.seat !== match.currentSeat || state.fired) return noop(state);
  // 手番側が切断中（制限時間を止めている）の射撃は届かないはずだが、届いても無視する
  if (match.deadlineAt === null) return noop(state);
  if (now > match.deadlineAt + state.config.graceMs) return noop(state);
  return resolveFire(state, event.seat, event.fire, now);
};

const onReplayDone = (state: EngineState, seat: Seat, now: number): Step => {
  if (state.match.phase !== "replaying") return noop(state);
  const replayDone = setPair(state.replayDone, seat, true);
  const next = { ...state, replayDone };
  return replayDone[0] && replayDone[1] ? startTurn(next, now) : noop(next);
};

const onDisconnect = (state: EngineState, seat: Seat, now: number): Step => {
  // 既に切断中の席への二重の切断は無視する。再接続の期限を延ばさないため
  if (state.match.phase === "finished" || !state.match.players[seat].connected) return noop(state);
  const connected = setConnected(state, seat, false);
  const deadlineAt = now + state.config.reconnectWaitMs;
  const pausing = state.match.phase === "acting" && state.match.currentSeat === seat && state.match.deadlineAt !== null;
  const next: EngineState = {
    ...connected,
    disconnectDeadlines: setPair(state.disconnectDeadlines, seat, deadlineAt),
    pausedRemainingMs: pausing ? Math.max(0, (state.match.deadlineAt as number) - now) : state.pausedRemainingMs,
    match: { ...connected.match, deadlineAt: pausing ? null : connected.match.deadlineAt },
    // 相手の再生完了は待たない
    replayDone: state.match.phase === "replaying" ? setPair(state.replayDone, seat, true) : state.replayDone,
  };
  const effects: Effect[] = [{ to: otherSeat(seat), message: { type: "conn.opponentDisconnected", deadlineAt } }];
  if (next.match.phase === "replaying" && next.replayDone[0] && next.replayDone[1]) {
    const started = startTurn(next, now);
    return { ...started, effects: [...effects, ...started.effects] };
  }
  return { state: next, effects, wakeAt: computeWakeAt(next) };
};

const onReconnect = (state: EngineState, seat: Seat, now: number): Step => {
  if (state.match.phase === "finished") return noop(state);
  const connected = setConnected(state, seat, true);
  const resuming = state.match.phase === "acting" && state.match.currentSeat === seat && state.pausedRemainingMs !== null;
  const deadlineAt = resuming ? now + (state.pausedRemainingMs as number) : connected.match.deadlineAt;
  const next: EngineState = {
    ...connected,
    disconnectDeadlines: setPair(state.disconnectDeadlines, seat, null),
    pausedRemainingMs: resuming ? null : state.pausedRemainingMs,
    match: { ...connected.match, deadlineAt },
    lastTurnStart: resuming && state.lastTurnStart ? { ...state.lastTurnStart, deadlineAt: deadlineAt as number } : state.lastTurnStart,
  };
  const effects: Effect[] = [
    { to: otherSeat(seat), message: { type: "conn.opponentReconnected" } },
    { to: seat, message: { type: "conn.state", match: next.match, seat } },
  ];
  // 制限時間を再開したら、新しい期限を相手と観戦者にも配る
  if (resuming && next.lastTurnStart) effects.push({ to: otherSeat(seat), message: next.lastTurnStart });
  if (next.match.phase === "replaying" && next.lastResult) effects.push({ to: seat, message: next.lastResult });
  return { state: next, effects, wakeAt: computeWakeAt(next) };
};

const onTick = (state: EngineState, now: number): Step => {
  const { match } = state;
  if (match.phase === "finished") return noop(state);
  // 両席の期限が同時に切れていたら、先に切れた側の負け
  const expired = ([0, 1] as const)
    .map((seat) => ({ seat, at: state.disconnectDeadlines[seat] }))
    .filter((e): e is { seat: Seat; at: number } => e.at !== null && now >= e.at)
    .sort((a, b) => a.at - b.at);
  const first = expired[0];
  if (first) return finish(state, otherSeat(first.seat), "disconnect");
  if (match.phase === "acting" && match.deadlineAt !== null && now >= match.deadlineAt + state.config.graceMs) {
    return pass(state, "timeout", now);
  }
  if (match.phase === "replaying" && state.replayWakeAt !== null && now >= state.replayWakeAt) {
    return startTurn(state, now);
  }
  return noop(state);
};

export const handle = (state: EngineState, event: EngineEvent, now: number): Step => {
  switch (event.type) {
    case "loaded":
      return onLoaded(state, event.seat, now);
    case "fire":
      return onFire(state, event, now);
    case "replayDone":
      return onReplayDone(state, event.seat, now);
    case "surrender":
      // 降参は対戦が始まってから（設計書 04 の 4.7）。Loading 中と決着後は無視する
      return state.match.phase === "finished" || state.match.phase === "loading" ? noop(state) : finish(state, otherSeat(event.seat), "surrender");
    case "disconnect":
      return onDisconnect(state, event.seat, now);
    case "reconnect":
      return onReconnect(state, event.seat, now);
    case "dissolve":
      return state.match.phase === "finished" ? noop(state) : finish(state, null, "dissolved");
    case "tick":
      return onTick(state, now);
  }
};
