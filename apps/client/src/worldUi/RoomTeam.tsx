import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "@/i18n/locale";
import { closeOnBackdrop } from "./dialogBackdrop";
import { DotIcon } from "./DotIcon";
import { PixelButton } from "./PixelUi";
import { TEAM_COLORS, teamColor, teamColorName } from "./teamColors";

/** チームの色見本と色の名前。色だけで伝えないよう、短い名前を並べる（設計書 45.5） */
const TeamChip = ({ teamId, label }: { readonly teamId: string | null; readonly label: string }) => {
  const { t } = useLanguage();
  if (!teamId) return <span>{label}</span>;
  const index = Number(teamId.slice(1));
  return <><span className="room-team-color" role="img" aria-label={label} title={label} style={{ "--team": teamColor(index) } as CSSProperties} /><span aria-hidden="true">{t(teamColorName(index))}</span></>;
};

export const RoomTeam = ({ teamId, editable, disabled, change }: {
  readonly teamId: string | null; readonly editable: boolean; readonly disabled: boolean;
  readonly change: (teamId: string) => void;
}) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open && editable) dialog.current?.showModal(); else dialog.current?.close(); }, [open, editable]);
  const label = teamId ? t("{color}チーム", { color: t(teamColorName(Number(teamId.slice(1)))) }) : t("未配置");
  return <div className="room-team-current">
    {editable ? <PixelButton aria-label={t("チームを変更: {team}", { team: label })} disabled={disabled} onClick={() => setOpen(true)}><TeamChip teamId={teamId} label={label} /></PixelButton> : <TeamChip teamId={teamId} label={label} />}
    {editable && <dialog ref={dialog} className="room-filter-dialog room-team-dialog" aria-label={t("チーム")} onCancel={() => setOpen(false)} onClick={event => closeOnBackdrop(event, () => setOpen(false))}>
      <h2>{t("チーム")}</h2>
      <PixelButton className="modal-close" aria-label={t("閉じる")} onClick={() => setOpen(false)}><DotIcon name="close" /></PixelButton>
      <div className="room-team-swatches" role="group" aria-label={t("チーム")}>{TEAM_COLORS.map((color, index) => <button type="button" key={color} disabled={disabled} aria-label={t("{color}チーム", { color: t(teamColorName(index)) })} aria-pressed={teamId === `t${index}`} onClick={() => { change(`t${index}`); setOpen(false); }}><span style={{ backgroundColor: color }} /></button>)}</div>
    </dialog>}
  </div>;
};
