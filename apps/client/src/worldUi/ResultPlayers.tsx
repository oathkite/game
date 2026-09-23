import type { CSSProperties } from "react";
import { DotIcon } from "./DotIcon";
import type { LabFrame } from "@game/protocol/v2-lab";
import { useLanguage } from "@/i18n/locale";
import { teamColor, teamColorName } from "./teamColors";
import { countUpAt, resultRowStepMs } from "./resultMotion";
import { useResultMotion } from "./useResultMotion";
import "./resultPlayers.css";
import "./lobbyTerminal.css";
import "./terminalScreens.css";
import { TankPortrait } from "./TankPortrait";

export type ResultPresentation = { readonly ownId?: string; readonly players: readonly Pick<LabFrame["players"][number], "playerId" | "teamId" | "nickname" | "colors">[]; readonly result: LabFrame["result"] };
type Score = NonNullable<LabFrame["stats"]>[string];

const ScoreCells = ({ score, elapsedMs }: { readonly score: Score | undefined; readonly elapsedMs: number }) => <>
  {(["shots", "enemyDamage", "friendlyDamage", "selfDamage"] as const).map(key => <td key={key}>{score ? countUpAt(elapsedMs, score[key]) : "—"}</td>)}
</>;

/** motionDelayMs: 段階表示を始めるまでの時間。シャッターが開ききってから始めたいときに渡す。 */
export const ResultPlayers = ({ players, result, stats, motionDelayMs = 0 }: ResultPresentation & { readonly stats?: LabFrame["stats"]; readonly motionDelayMs?: number }) => {
  const { t } = useLanguage();
  const { playing, elapsedMs } = useResultMotion(players.length, motionDelayMs);
  if (result.type === "ongoing") return null;
  const rowStep = resultRowStepMs(players.length);
  return <div className="battle-result-players result-table-scroll" data-motion={playing ? "play" : "done"} style={{ "--row-step": `${rowStep}ms`, "--motion-delay": `${motionDelayMs}ms` } as CSSProperties}><table className="result-table" aria-label={t("試合成績")}>
    <thead><tr><th scope="col">{t("プレイヤー名")}</th><th scope="col">{t("チーム")}</th><th scope="col">{t("結果")}</th>{stats && <><th scope="col">{t("発射数")}</th><th scope="col">{t("敵へのダメージ")}</th><th scope="col">{t("味方へのダメージ")}</th><th scope="col">{t("自分へのダメージ")}</th></>}</tr></thead>
    <tbody>{players.map((player, index) => {
      const reaction = result.type === "draw" ? "draw" : player.teamId === result.teamId ? "win" : "lose";
      const name = player.nickname ?? player.playerId;
      const label = t(reaction === "win" ? "勝利" : reaction === "lose" ? "敗北" : "引き分け");
      const team = Number(player.teamId.slice(1));
      return <tr key={player.playerId} data-reaction={reaction} style={{ "--row": index } as CSSProperties}>
        <th scope="row"><div className="result-player-name"><TankPortrait colors={player.colors} label={`${name}：${label}`} /><span>{name}</span></div></th>
        <td><span className="result-team" role="img" aria-label={t(teamColorName(team))} title={t(teamColorName(team))} style={{ backgroundColor: teamColor(team) }} /></td>
        <td className="result-outcome"><span className="result-outcome-label">{reaction === "win" && <DotIcon name="crown" />}{label}</span></td>
        {stats && <ScoreCells score={stats[player.playerId]} elapsedMs={elapsedMs - index * rowStep} />}
      </tr>;
    })}</tbody>
  </table></div>;
};
