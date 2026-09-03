import type { Facing, Seat } from "@game/protocol";
import { ELEVATION_MAX, ELEVATION_MIN, STEPS_PER_TURN, stepOutcome } from "@game/sim";
import { createListeners } from "@/net/connection";
import type { Connection } from "@/net/connection";
import { reduce, type ReduceOptions } from "./reduce";
import { EMPTY_VIEW, type LocalControl, type MatchView } from "./types";

// 対戦の表示状態を持ち、操作をサーバーへのメッセージに変える。

export type MatchStore = {
  readonly getView: () => MatchView;
  readonly subscribe: (fn: () => void) => () => void;
  readonly moveStep: (dir: Facing) => void;
  readonly changeElevation: (delta: number) => void;
  /** dir 方向に 1 歩進めるか。進めなければボタンを暗くする */
  readonly canStep: (dir: Facing) => boolean;
  readonly fire: (power: number) => void;
  readonly completeReplay: (id: number) => void;
  readonly surrender: () => void;
  readonly closeResult: () => void;
  readonly onMismatch: (fn: (view: MatchView) => void) => () => void;
  /** 自分の席が決まった（入室、席の移動）ときに呼ぶ。手番中なら操作を有効にする */
  readonly setSeat: (seat: Seat | null, spectator: boolean) => void;
  readonly dispose: () => void;
};

export const createMatchStore = (connection: Connection, initialOptions: ReduceOptions): MatchStore => {
  let options = initialOptions;
  let view = EMPTY_VIEW;
  let replaySeq = 0;
  const listeners = createListeners<void>();
  const mismatches = createListeners<MatchView>();

  const set = (next: MatchView): void => {
    view = next;
    listeners.emit();
  };

  const unsubscribe = connection.subscribe((message) => {
    const r = reduce(view, message, options, ++replaySeq);
    set(r.view);
    if (r.mismatch) {
      console.warn("再計算がサーバーの結果と食い違った", message);
      mismatches.emit(r.view);
    }
    if (r.reply === "match.ready") connection.send({ type: "match.ready" });
    if (r.reply === "turn.replayDone" && !options.spectator) connection.send({ type: "turn.replayDone" });
  });

  const moveStep = (dir: Facing): void => {
    const c = view.control;
    if (view.phase !== "acting" || !c || !view.mask) return;
    // 左右の入力は向きも変える。歩数がなくても向きだけは変わる
    if (c.stepsLeft <= 0 || c.fell) {
      set({ ...view, control: { ...c, facing: dir } });
      return;
    }
    const outcome = stepOutcome(view.mask, c.x, dir);
    if (outcome === "blocked") {
      set({ ...view, control: { ...c, facing: dir } });
      return;
    }
    set({ ...view, control: { ...c, facing: dir, x: c.x + dir, stepsLeft: c.stepsLeft - 1, fell: outcome === "fell" } });
  };

  const canStep = (dir: Facing): boolean => {
    const c = view.control;
    if (view.phase !== "acting" || !c || !view.mask) return false;
    if (c.stepsLeft <= 0 || c.fell) return false;
    return stepOutcome(view.mask, c.x, dir) !== "blocked";
  };

  const changeElevation = (delta: number): void => {
    const c = view.control;
    if (view.phase !== "acting" || !c) return;
    const elevation = Math.min(ELEVATION_MAX, Math.max(ELEVATION_MIN, c.elevation + delta));
    if (elevation !== c.elevation) set({ ...view, control: { ...c, elevation } });
  };

  const fire = (power: number): void => {
    const c = view.control;
    if (view.phase !== "acting" || !c) return;
    connection.send({ type: "turn.fire", facing: c.facing, elevation: c.elevation, power, x: c.x });
    set({ ...view, phase: "fired" });
  };

  const completeReplay = (id: number): void => {
    const job = view.replay;
    if (!job || job.id !== id) return;
    const finished = view.result !== null;
    set({
      ...view,
      mask: job.maskAfter,
      players: job.playersAfter,
      replay: null,
      phase: finished ? "finished" : "waiting",
    });
    if (!finished && !view.spectator) connection.send({ type: "turn.replayDone" });
  };

  const setSeat = (seat: Seat | null, spectator: boolean): void => {
    options = { ...options, mySeat: seat, spectator };
    if (view.phase === "idle" || options.followCurrentSeat) return;
    const acting = seat !== null && !spectator && view.currentSeat === seat && view.deadlineAt !== null && (view.phase === "waiting" || view.phase === "acting");
    const player = view.players?.[seat ?? 0];
    const control: LocalControl | null =
      acting && player ? { x: player.x, facing: player.facing, elevation: view.control?.elevation ?? 45, stepsLeft: STEPS_PER_TURN, fell: false } : null;
    set({ ...view, mySeat: seat, spectator, phase: acting ? "acting" : view.phase === "acting" ? "waiting" : view.phase, control: acting ? control : view.phase === "acting" ? null : view.control });
  };

  return {
    getView: () => view,
    subscribe: (fn) => listeners.add(() => fn()),
    setSeat,
    moveStep,
    changeElevation,
    canStep,
    fire,
    completeReplay,
    surrender: () => connection.send({ type: "match.surrender" }),
    closeResult: () => connection.send({ type: "result.close" }),
    onMismatch: mismatches.add,
    dispose: unsubscribe,
  };
};
