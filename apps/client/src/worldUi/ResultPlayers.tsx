import type { CSSProperties } from "react";
import type { LabFrame } from "@game/protocol/v2-lab";
import { useLanguage } from "@/i18n/locale";
import expressions from "../../../../assets/runtime/world-v1/pilot-result-expressions.webp";
import neutral from "../../../../assets/runtime/world-v1/pilot-portrait.webp";
import { teamColor } from "./teamColors";

export const ResultPlayers = ({ players, result }: Pick<LabFrame, "players" | "result">) => {
  const { t } = useLanguage();
  if (result.type === "ongoing") return null;
  return <div className="battle-result-players">{players.map(player => {
    const reaction = result.type === "draw" ? "draw" : player.teamId === result.teamId ? "win" : "lose";
    const name = player.nickname ?? player.playerId;
    const label = t(reaction === "win" ? "勝利" : reaction === "lose" ? "敗北" : "引き分け");
    return <div className="battle-result-player" key={player.playerId} data-reaction={reaction} style={{ "--team": teamColor(Number(player.teamId.slice(1))) } as CSSProperties}>
      <svg viewBox="0 0 1 1" role="img" aria-label={`${name}：${label}`}>
        <image href={reaction === "draw" ? neutral : expressions} x={reaction === "lose" ? -1 : 0} width={reaction === "draw" ? 1 : 2} height="1" />
      </svg><strong>{name}</strong>
    </div>;
  })}</div>;
};
