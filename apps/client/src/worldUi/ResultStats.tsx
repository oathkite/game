import type { LabFrame } from "@game/protocol/v2-lab";
import { useLanguage } from "@/i18n/locale";
export const ResultStats = ({ players, stats }: Pick<LabFrame, "players" | "stats">) => {
  const { t } = useLanguage();
  if (!stats) return null;
  return <div className="battle-result-stats"><table aria-label={t("試合成績")}>
    <thead><tr><th>{t("名前")}</th><th>{t("発射数")}</th><th>{t("敵へのダメージ")}</th><th>{t("味方へのダメージ")}</th><th>{t("自分へのダメージ")}</th></tr></thead>
    <tbody>{players.map(player => <tr key={player.playerId}><th scope="row">{player.nickname ?? player.playerId}</th>
      <td>{stats[player.playerId]?.shots ?? "—"}</td><td>{stats[player.playerId]?.enemyDamage ?? "—"}</td><td>{stats[player.playerId]?.friendlyDamage ?? "—"}</td><td>{stats[player.playerId]?.selfDamage ?? "—"}</td>
    </tr>)}</tbody>
  </table></div>;
};
