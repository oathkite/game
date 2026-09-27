import type { MatchView } from "./types";

/** 表示してよい風の値（設計書 08 の 8.5）。1 ターン目の turn.start までは view.wind が初期値 0 のままで無風を意味しないので、null を返す */
export const decidedWind = (view: Pick<MatchView, "turnNumber" | "wind">): number | null => view.turnNumber > 0 ? view.wind.value : null;
