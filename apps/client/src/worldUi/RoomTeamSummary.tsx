import { useLanguage } from "@/i18n/locale";
import { teamColor, teamColorName } from "./teamColors";

export const RoomTeamSummary = ({ members }: { readonly members: readonly { readonly teamId: string | null }[] }) => {
  const { t } = useLanguage();
  const teams = Array.from({ length: 8 }, (_, index) => ({ index, count: members.filter(member => member.teamId === `t${index}`).length })).filter(team => team.count > 0);
  const unassigned = members.filter(member => member.teamId === null).length;
  const uneven = new Set(teams.map(team => team.count)).size > 1;
  return <div className="room-team-summary">
    <ul aria-label={t("チーム編成")}>
      {teams.map(team => <li key={team.index} style={{ borderLeftColor: teamColor(team.index) }}>{t("{color}チーム: {count}人", { color: t(teamColorName(team.index)), count: team.count })}</li>)}
      {unassigned > 0 && <li>{t("未配置: {count}人", { count: unassigned })}</li>}
    </ul>
    {uneven && <strong>{t("人数差あり")}</strong>}
  </div>;
};
