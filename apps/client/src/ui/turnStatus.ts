import type { MatchView } from "@/match/types";

// 手番の状態を文字にする純関数。設計書 03 の 3.7。ターン数は含めない。
// 自分の手番だけを明るい緑で、それ以外は暗い緑で出す。

export type TurnStatus = {
  readonly kind: "mine" | "theirs" | "replaying" | "between";
  readonly label: string;
  /** 明るい緑で出す。自分の手番だけ true */
  readonly bright: boolean;
};

export const turnStatus = (view: MatchView): TurnStatus | null => {
  switch (view.phase) {
    case "idle":
    case "loading":
    case "finished":
      return null;
    case "replaying":
      return { kind: "replaying", label: "再生中", bright: false };
    case "acting":
    case "fired":
      return { kind: "mine", label: "あなたの番", bright: true };
    case "waiting":
      break;
  }
  // パスや再生の直後は次の turn.start を待っている。手番側の表示を残さない
  if (view.deadlineAt === null) return { kind: "between", label: "待機中", bright: false };
  if (view.spectator) {
    const name = view.players?.[view.currentSeat].nickname ?? "";
    return { kind: "theirs", label: `${name} の番`, bright: false };
  }
  if (view.currentSeat === view.mySeat) return { kind: "mine", label: "あなたの番", bright: true };
  return { kind: "theirs", label: "相手の番", bright: false };
};

/** ターン開始のバナーを出すか。手番が決まって制限時間が動き始めたときだけ */
export const shouldAnnounceTurn = (view: MatchView): boolean =>
  (view.phase === "acting" || view.phase === "waiting") && view.deadlineAt !== null;
