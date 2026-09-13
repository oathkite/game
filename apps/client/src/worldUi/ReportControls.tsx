import { useState } from "react";
import { useLanguage } from "@/i18n/locale";
export type ReportReason = "name" | "abuse" | "cheating";
export type ReportOptions = { readonly players: readonly { readonly id: string; readonly name: string }[]; readonly status: string; readonly send: (targetId: string, reason: ReportReason) => void };
export const ReportControls = ({ players, status, send }: ReportOptions) => {
  const { t } = useLanguage();
  const [target, setTarget] = useState(players[0]?.id ?? ""), [reason, setReason] = useState<ReportReason>("name");
  return <details><summary>{t("プレイヤーを通報")}</summary>
    <label>{t("対象")}<select aria-label={t("通報するプレイヤー")} value={target} onChange={e => setTarget(e.target.value)}>{players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
    <label>{t("理由")}<select aria-label={t("通報理由")} value={reason} onChange={e => setReason(e.target.value as ReportReason)}><option value="name">{t("不適切な名前")}</option><option value="abuse">{t("迷惑行為")}</option><option value="cheating">{t("不正行為の疑い")}</option></select></label>
    <p>{t("対象の名前・試合情報・理由を運営向けに保存します（7日間）。")}</p>
    <button disabled={!target || status === "送信中…"} onClick={() => send(target, reason)}>{t("通報を送信")}</button>
    {status && <p role="status">{t(status)}</p>}
  </details>;
};
