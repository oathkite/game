import type { Seat } from "@game/protocol";
import type { MatchView } from "./types";

/**
 * 今が手番中の席。自分の手番は acting、相手の手番は自分の画面では waiting になるので、両方を見る。
 * パスや再生の直後に次のターンを待っている waiting は残り時間が無い（deadlineAt が null）ので、どの席も手番にしない。
 */
export const turnSeatOf = (view: MatchView): Seat | null =>
  view.deadlineAt !== null && (view.phase === "acting" || view.phase === "waiting") ? view.currentSeat : null;
