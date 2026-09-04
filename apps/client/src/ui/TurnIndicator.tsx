import { useEffect, useRef, useState } from "react";
import type { MatchView } from "@/match/types";
import { shouldAnnounceTurn, turnCounter, turnStatus } from "./turnStatus";

// 手番の表示。設計書 03 の 3.7。
// 上端中央の残り時間の下に常時ラベルを出し、ターンの切り替わりにはマップの中央へ大きく一瞬だけ出す。
// バナーは入力を遮らない（pointer-events: none）。

export const TURN_BANNER_MS = 1200;

export const TurnLabel = ({ view }: { readonly view: MatchView }) => {
  const status = turnStatus(view);
  const counter = turnCounter(view);
  if (!status && counter === null) return null;
  return (
    <div className="turn-line">
      {counter !== null && (
        <span className="turn-count dim" data-testid="turn-count">
          {counter}
        </span>
      )}
      {status && (
        <span className={`turn-label${status.bright ? "" : " dim"}`} data-testid="turn-label" data-turn={status.kind}>
          {status.label}
        </span>
      )}
    </div>
  );
};

export const TurnBanner = ({ view }: { readonly view: MatchView }) => {
  const [shown, setShown] = useState(false);
  const announced = useRef<string | null>(null);
  const announce = shouldAnnounceTurn(view);
  // ターンの切り替わりを表す鍵。再接続で同じターンが送り直されても、番号と手番側が同じなら演出しない
  const turnKey = `${view.turnNumber}:${view.currentSeat}`;

  useEffect(() => {
    // 撃った、パスした、再生に入ったなど告知の条件から外れたら、残っている表示を消す
    if (!announce) {
      setShown(false);
      return;
    }
    // 再接続でターンが送り直されただけなら、告知済みのターンを演出し直さない
    if (announced.current === turnKey) return;
    announced.current = turnKey;
    setShown(true);
    const id = window.setTimeout(() => setShown(false), TURN_BANNER_MS);
    return () => window.clearTimeout(id);
  }, [announce, turnKey]);

  const status = turnStatus(view);
  if (!shown || !status || status.kind === "between" || status.kind === "replaying") return null;
  return (
    <div className="turn-banner" data-testid="turn-banner">
      <div className={`turn-banner-text${status.bright ? "" : " dim"}`}>{status.label}</div>
    </div>
  );
};
