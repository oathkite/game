import type { CSSProperties } from "react";
import type { LabFrame } from "@game/protocol/v2-lab";
import { useLanguage } from "@/i18n/locale";
import { teamColor } from "./teamColors";
import "./resultPlayers.css";
import { TankPortrait } from "./TankPortrait";

export type ResultPresentation = { readonly players: readonly Pick<LabFrame["players"][number], "playerId" | "teamId" | "nickname" | "colors">[]; readonly result: LabFrame["result"] };

export const ResultPlayers = ({ players, result }: ResultPresentation) => {
  const { t } = useLanguage();
  if (result.type === "ongoing") return null;
  return <div className="battle-result-players">{players.map(player => {
    const reaction = result.type === "draw" ? "draw" : player.teamId === result.teamId ? "win" : "lose";
    const name = player.nickname ?? player.playerId;
    const label = t(reaction === "win" ? "勝利" : reaction === "lose" ? "敗北" : "引き分け");
    return <div className="battle-result-player" key={player.playerId} data-reaction={reaction} style={{ "--team": teamColor(Number(player.teamId.slice(1))) } as CSSProperties}>
      <TankPortrait colors={player.colors} label={`${name}：${label}`} /><strong>{name}</strong>
    </div>;
  })}</div>;
};
