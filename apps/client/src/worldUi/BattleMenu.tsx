import { BattleMenuStatus } from "./BattleMenuStatus";
import { ReportControls, type ReportOptions } from "./ReportControls";
import { AudioControls } from "./AudioControls";
import { useLanguage } from "@/i18n/locale";
import { useEffect, useRef, useState } from "react";
export const BattleMenu = ({ seconds, close, surrender, exit, finished, report, diagnostics, latency, spectator = false, activeTurn = false }: { readonly seconds: number | null; readonly activeTurn?: boolean; readonly latency?: number | null; readonly report?: ReportOptions; readonly diagnostics?: string; readonly spectator?: boolean; readonly close: () => void; readonly surrender: () => void; readonly exit: (() => void) | undefined; readonly finished: boolean }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const text = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="battle-menu-panel" aria-label={t("対戦設定")} onCancel={e => { e.preventDefault(); close(); }}>
    {!finished && <BattleMenuStatus activeTurn={activeTurn && !spectator}>{seconds === null ? "—" : `${seconds}s`}</BattleMenuStatus>}
    <button autoFocus onClick={close}>{t("対戦に戻る")}</button>{!spectator && <button disabled={finished} onClick={surrender}>{t("降参")}</button>}<button onClick={exit}>{t("ロビーに戻る")}</button>
    <AudioControls />
    {latency != null && <p>{t("通信遅延")} {latency} ms</p>}
    {!spectator && <p>{t("A / D・← / →：移動　W / S・↑ / ↓：角度")}<br />{t("Space：溜めて発射　Q / E：武器　Tab：機体を順に見る")}</p>}
    {report && <ReportControls {...report} />}
    {diagnostics && <details><summary>{t("試合の診断情報")}</summary>
      <textarea ref={text} aria-label={t("試合の診断情報")} readOnly value={diagnostics} rows={7} onFocus={e => e.currentTarget.select()} />
      <button onClick={() => { void (navigator.clipboard?.writeText(diagnostics) ?? Promise.reject()).then(() => setCopied(true), () => { text.current?.focus(); text.current?.select(); }); }}>{t("診断情報をコピー")}</button>
      {copied && <span role="status">{t("コピーしました")}</span>}
    </details>}
  </dialog>;
};
