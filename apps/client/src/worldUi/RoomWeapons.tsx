import { DotIcon } from "./DotIcon";
import { useEffect, useRef, useState } from "react";
import { WEAPON_DELAY, WEAPON_IDS, WEAPON_LABELS, type WeaponId } from "@game/protocol";
import { useLanguage } from "@/i18n/locale";
import { WeaponIcon } from "./WeaponIcon";
import { PixelButton } from "./PixelUi";

export const RoomWeapons = ({ loadout, editable = false, disabled = false, change }: {
  readonly loadout: readonly [WeaponId, WeaponId]; readonly editable?: boolean; readonly disabled?: boolean;
  readonly change?: (loadout: readonly [WeaponId, WeaponId]) => void;
}) => {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<0 | 1>(0);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  return <div className="room-member-weapons">
    {loadout.map((weapon, index) => <span key={index} role="img" aria-label={t(WEAPON_LABELS[weapon])} title={t(WEAPON_LABELS[weapon])}><WeaponIcon weapon={weapon} /></span>)}
    {editable && <>
      <PixelButton disabled={disabled} onClick={() => setOpen(true)}>{t("変更")}</PixelButton>
      <dialog ref={dialog} className="room-filter-dialog room-weapon-dialog" aria-label={t("武器変更")} onCancel={() => setOpen(false)} onClick={event => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setOpen(false);
      }}>
        <h2>{t("武器変更")}</h2>
        <div className="room-weapon-slots">{([0, 1] as const).map(index => <section className="room-weapon-slot" key={index}><h3>{t("装備")} {index + 1}</h3><PixelButton aria-label={`${t("装備")} ${index + 1} ${t(WEAPON_LABELS[loadout[index]])}`} aria-pressed={slot === index} onClick={() => setSlot(index)}><span className="room-weapon-slot-label"><span>{t(WEAPON_LABELS[loadout[index]])}</span><small>{t("コスト")} {WEAPON_DELAY[loadout[index]]}</small></span><WeaponIcon weapon={loadout[index]} /></PixelButton></section>)}</div>
        <div className="room-weapon-options">{WEAPON_IDS.map(weapon => <PixelButton key={weapon} disabled={disabled || weapon === loadout[slot === 0 ? 1 : 0]} aria-pressed={loadout[slot] === weapon} onClick={() => change?.(slot === 0 ? [weapon, loadout[1]] : [loadout[0], weapon])}><WeaponIcon weapon={weapon} />{t(WEAPON_LABELS[weapon])}<small>{t("コスト")} {WEAPON_DELAY[weapon]}</small></PixelButton>)}</div>
        <PixelButton className="modal-close" aria-label={t("閉じる")} onClick={() => setOpen(false)}><DotIcon name="close" /></PixelButton>
      </dialog>
    </>}
  </div>;
};
