import { COLOR_HEX, type FinishReason, type MatchResult } from "@game/protocol";
import type { PlayerView } from "@/match/types";

// リザルト。設計書 09 の 9.6。勝者と決着の理由、経過ターン数、各プレイヤーの与ダメージと直撃数。

type Props = {
  readonly result: MatchResult;
  readonly players: readonly [PlayerView, PlayerView];
  readonly onClose: () => void;
  readonly closeLabel: string;
  readonly onLeave?: () => void;
};

const REASONS: Readonly<Record<FinishReason, string>> = {
  hp: "HP",
  ringOut: "リングアウト",
  turnLimit: "ターン上限",
  surrender: "降参",
  disconnect: "切断",
  dissolved: "解散",
};

export const ResultScreen = ({ result, players, onClose, closeLabel, onLeave }: Props) => {
  const winner = result.winner === null ? null : players[result.winner];
  return (
    <div className="screen" data-testid="result">
      <div className="column">
        <div className="title">RESULT</div>
        <div className="box column" style={{ gap: 8 }}>
          <div style={{ fontSize: 32 }}>
            {winner ? <span style={{ color: COLOR_HEX[winner.colors.primary] }}>{winner.nickname}</span> : "引き分け"}
            {winner ? " の勝ち" : ""}
          </div>
          <div className="dim">
            {REASONS[result.reason]} / {result.turns} ターン
          </div>
        </div>
        {players.map((p, i) => (
          <div key={p.seat} className="box row" style={{ justifyContent: "space-between" }}>
            <span>
              <span className="swatch" style={{ background: COLOR_HEX[p.colors.primary], marginRight: 8 }} />
              {p.nickname}
            </span>
            <span className="dim">与ダメージ {result.stats[i]?.damageDealt ?? 0}</span>
            <span className="dim">直撃 {result.stats[i]?.directHits ?? 0}</span>
          </div>
        ))}
        <button type="button" onClick={onClose} data-testid="result-close">
          {closeLabel}
        </button>
        {onLeave && (
          <button type="button" onClick={onLeave} data-testid="result-leave">
            退出
          </button>
        )}
      </div>
    </div>
  );
};
