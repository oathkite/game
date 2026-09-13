import type { LabFrame } from "@game/protocol/v2-lab";
import { useLanguage } from "@/i18n/locale";
import { teamColor, teamColorName } from "./teamColors";
import "./resultPlayers.css";
import { TankPortrait } from "./TankPortrait";

export type ResultPresentation = { readonly players: readonly Pick<LabFrame["players"][number], "playerId" | "teamId" | "nickname" | "colors">[]; readonly result: LabFrame["result"] };

export const ResultPlayers = ({ players, result, stats }: ResultPresentation & { readonly stats?: LabFrame["stats"] }) => {
  const { t } = useLanguage();
  if (result.type === "ongoing") return null;
  return <div className="battle-result-players result-table-scroll"><table className="result-table" aria-label={t("試合成績")}>
    <thead><tr><th scope="col">{t("プレイヤー名")}</th><th scope="col">{t("チーム")}</th><th scope="col">{t("結果")}</th>{stats && <><th scope="col">{t("発射数")}</th><th scope="col">{t("敵へのダメージ")}</th><th scope="col">{t("味方へのダメージ")}</th><th scope="col">{t("自分へのダメージ")}</th></>}</tr></thead>
    <tbody>{players.map(player => {
      const reaction = result.type === "draw" ? "draw" : player.teamId === result.teamId ? "win" : "lose";
      const name = player.nickname ?? player.playerId;
      const label = t(reaction === "win" ? "勝利" : reaction === "lose" ? "敗北" : "引き分け");
      const team = Number(player.teamId.slice(1));
      const score = stats?.[player.playerId];
      return <tr key={player.playerId} data-reaction={reaction}>
        <th scope="row"><div className="result-player-name"><TankPortrait colors={player.colors} label={`${name}：${label}`} /><span>{name}</span></div></th>
        <td><span className="result-team" role="img" aria-label={t(teamColorName(team))} title={t(teamColorName(team))} style={{ backgroundColor: teamColor(team) }} /></td>
        <td className="result-outcome">{label}</td>
        {stats && <><td>{score?.shots ?? "—"}</td><td>{score?.enemyDamage ?? "—"}</td><td>{score?.friendlyDamage ?? "—"}</td><td>{score?.selfDamage ?? "—"}</td></>}
      </tr>;
    })}</tbody>
  </table></div>;
};
