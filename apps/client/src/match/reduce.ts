import { getMap } from "@game/maps";
import type { MatchState, Seat, ServerMessage, ShotResult } from "@game/protocol";
import { applyOps, ELEVATION_MAX, ELEVATION_MIN, simulateShot, STEPS_PER_TURN } from "@game/sim";
import { EMPTY_VIEW, type LocalControl, type MatchView, type PlayerView, type ReplayJob } from "./types";

// サーバーのメッセージを表示状態に畳み込む純関数。

export type ReduceOptions = {
  /** solo モードでは手番側を常に自分として扱う */
  readonly followCurrentSeat: boolean;
  readonly mySeat: Seat | null;
  readonly spectator: boolean;
};

export type Reduced = {
  readonly view: MatchView;
  /** 呼び出し側が送るべきメッセージ */
  readonly reply: "match.ready" | "turn.replayDone" | null;
  readonly mismatch: boolean;
};

const otherSeat = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

const just = (view: MatchView, reply: Reduced["reply"] = null, mismatch = false): Reduced => ({ view, reply, mismatch });

const freshControl = (player: PlayerView, elevation: number): LocalControl => ({
  x: player.x,
  facing: player.facing,
  elevation: Math.min(ELEVATION_MAX, Math.max(ELEVATION_MIN, elevation)),
  stepsLeft: STEPS_PER_TURN,
  fell: false,
});

const fromMatchState = (view: MatchView, match: MatchState, seat: Seat | null, options: ReduceOptions): MatchView => {
  const mask = applyOps(getMap(match.mapName).build(), match.terrainOps);
  const players: readonly [PlayerView, PlayerView] = [match.players[0], match.players[1]];
  const mySeat = options.followCurrentSeat ? match.currentSeat : seat;
  const acting = match.phase === "acting" && mySeat === match.currentSeat && !options.spectator;
  return {
    ...view,
    mask,
    players,
    mySeat,
    spectator: options.spectator,
    currentSeat: match.currentSeat,
    turnNumber: match.turnNumber,
    wind: match.wind,
    deadlineAt: match.deadlineAt,
    result: match.result,
    phase: match.phase === "finished" ? "finished" : match.phase === "loading" ? "loading" : match.phase === "replaying" ? "waiting" : acting ? "acting" : "waiting",
    control: acting ? freshControl(players[match.currentSeat], view.lastElevation) : null,
    replay: null,
    // 送り直される turn.result は再生せず、確定状態に直行する（設計書 05 の 5.3）
    skipNextResult: match.phase === "replaying",
  };
};

const sameShot = (a: ShotResult, b: ShotResult): boolean =>
  JSON.stringify([a.impact, a.terrainOp, a.damage, a.hpAfter, a.xAfter, a.ringOut, a.finished]) ===
  JSON.stringify([b.impact, b.terrainOp, b.damage, b.hpAfter, b.xAfter, b.ringOut, b.finished]);

const onResult = (view: MatchView, shot: ShotResult, replayId: number): Reduced => {
  if (!view.mask || !view.players) return just(view);
  const [p0, p1] = view.players;
  const local = simulateShot(view.mask, [{ x: p0.x, hp: p0.hp }, { x: p1.x, hp: p1.hp }], shot.input);
  const mismatch = !sameShot(local.result, shot);
  // 食い違ったらサーバーの値で上書きする（設計書 05 の 5.1）
  const maskAfter = mismatch
    ? shot.terrainOp
      ? applyOps(view.mask, [shot.terrainOp])
      : view.mask
    : local.mask;
  const after = (p: PlayerView): PlayerView => ({
    ...p,
    hp: shot.hpAfter[p.seat],
    x: shot.xAfter[p.seat],
    facing: p.seat === shot.input.seat ? shot.input.facing : p.facing,
  });
  const job: ReplayJob = {
    id: replayId,
    shot,
    path: local.path,
    maskBefore: view.mask,
    maskAfter,
    playersBefore: view.players,
    playersAfter: [after(p0), after(p1)],
  };
  return just(
    { ...view, phase: "replaying", replay: job, control: null, deadlineAt: null, mismatches: view.mismatches + (mismatch ? 1 : 0) },
    null,
    mismatch,
  );
};

export const reduce = (view: MatchView, message: ServerMessage, options: ReduceOptions, replayId: number): Reduced => {
  switch (message.type) {
    case "match.setup": {
      const mask = getMap(message.mapName).build();
      const players: readonly [PlayerView, PlayerView] = [
        { ...message.players[0], hp: message.hp, facing: message.players[0].x < message.players[1].x ? 1 : -1, connected: true },
        { ...message.players[1], hp: message.hp, facing: message.players[1].x < message.players[0].x ? 1 : -1, connected: true },
      ];
      return just(
        { ...EMPTY_VIEW, phase: "loading", mask, players, mySeat: options.mySeat, spectator: options.spectator, currentSeat: message.firstSeat },
        "match.ready",
      );
    }
    case "conn.state":
      // Loading 中に再接続したら、読み込み完了を送り直す。送らないとサーバーは両者の完了を待ち続ける
      return just(fromMatchState(view, message.match, message.seat, options), message.match.phase === "loading" ? "match.ready" : null);
    case "turn.start": {
      // 再生が終わる前に次のターンが来たら、再生を打ち切って確定状態に合わせる（設計書 04 の 4.4）
      const settled: MatchView = view.replay ? { ...view, mask: view.replay.maskAfter, players: view.replay.playersAfter, replay: null } : view;
      if (!settled.players) return just(settled);
      const mySeat = options.followCurrentSeat ? message.seat : settled.mySeat;
      const acting = mySeat === message.seat && !settled.spectator;
      return just({
        ...settled,
        phase: acting ? "acting" : "waiting",
        mySeat,
        currentSeat: message.seat,
        turnNumber: message.turnNumber,
        wind: message.wind,
        deadlineAt: message.deadlineAt,
        control: acting ? freshControl(settled.players[message.seat], settled.lastElevation) : null,
        skipNextResult: false,
      });
    }
    case "turn.result":
      if (view.skipNextResult) return just({ ...view, skipNextResult: false, phase: "waiting" }, "turn.replayDone");
      return onResult(view, message.shot, replayId);
    case "turn.pass":
      // 移動はサーバーに届いていないので、表示上の位置をターン開始時に戻す
      return just({ ...view, phase: "waiting", control: null, deadlineAt: null });
    case "match.finished": {
      const finished: MatchView = { ...view, result: message.result, deadlineAt: null };
      // 再生中なら再生の終わりに finished へ移す
      return just(view.phase === "replaying" ? finished : { ...finished, phase: "finished", control: null });
    }
    case "conn.opponentDisconnected": {
      // 切れたのが手番側なら、サーバーは制限時間を止めている。こちらの表示も止める
      const opponent = view.mySeat === null ? null : otherSeat(view.mySeat);
      const paused = opponent !== null && view.currentSeat === opponent;
      return just({ ...view, opponentDisconnectedUntil: message.deadlineAt, deadlineAt: paused ? null : view.deadlineAt });
    }
    case "conn.opponentReconnected":
      return just({ ...view, opponentDisconnectedUntil: null });
    default:
      return just(view);
  }
};
