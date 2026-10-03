import { useEffect, useRef, useState } from "react";
import { COLOR_HEX, DEFAULT_FRAME, DEFAULT_TURRET, FRAME_LABELS, FRAME_SKINS, PLAYER_COLORS, TURRET_LABELS, TURRET_SKINS, type Loadout, type PlayerColor, type TankColors } from "@game/protocol";
import { useLanguage } from "@/i18n/locale";
import { closeOnBackdrop } from "./dialogBackdrop";
import { DotIcon } from "./DotIcon";
import { PixelButton } from "./PixelUi";
import { TankPortrait } from "./TankPortrait";
import "./tankCustomizer.css";

// 出撃準備の機体のカスタマイズ（設計書 09 の 9.2、43）。色 2 つ（カラー 1、カラー 2）と、砲塔と足回りのスキンをモーダルで選ぶ。
// 選択はすぐに保存し、モーダルの中の機体で確かめる。完了、Esc、背景のクリックで閉じ、開いたボタンへフォーカスを戻す。

type Props = { readonly colors: TankColors; readonly loadout: Loadout; readonly onChange: (colors: TankColors) => void };

/** 色の 1 列。カラー 1 は砲塔と砲身（副色）、カラー 2 は車体（主色）。機体の上の部品から順に並べる */
const ColorChoice = ({ label, value, pick }: { readonly label: string; readonly value: PlayerColor; readonly pick: (color: PlayerColor) => void }) =>
  <fieldset className="tank-look-colors"><legend>{label}</legend><div role="radiogroup" aria-label={label}>
    {PLAYER_COLORS.map(color => <button type="button" role="radio" aria-label={color} aria-checked={value === color} key={color} onClick={() => pick(color)}><i style={{ background: COLOR_HEX[color] }} /></button>)}
  </div></fieldset>;

/** スキンの 1 列。候補ごとに、その形にした今の機体を小さく描く */
const SkinChoice = <T extends string>({ label, options, labels, value, look, loadout, pick }: {
  readonly label: string; readonly options: readonly T[]; readonly labels: Readonly<Record<T, string>>; readonly value: T;
  readonly look: (option: T) => TankColors; readonly loadout: Loadout; readonly pick: (option: T) => void;
}) => {
  const { t } = useLanguage();
  return <fieldset className="tank-look-skins"><legend>{label}</legend><div role="radiogroup" aria-label={label}>
    {options.map(option => <button type="button" role="radio" aria-checked={value === option} key={option} onClick={() => pick(option)}>
      <span aria-hidden="true"><TankPortrait colors={look(option)} loadout={loadout} /></span>{t(labels[option])}
    </button>)}
  </div></fieldset>;
};

export const TankCustomizer = ({ colors, loadout, onChange }: Props) => {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  const turret = colors.turret ?? DEFAULT_TURRET, frame = colors.frame ?? DEFAULT_FRAME;
  const close = () => setOpen(false);
  return <div className="tank-look">
    <div className="tank-look-summary">
      <span className="tank-look-swatches">
        <i role="img" aria-label={`${t("カラー1")} ${colors.secondary}`} style={{ background: COLOR_HEX[colors.secondary] }} />
        <i role="img" aria-label={`${t("カラー2")} ${colors.primary}`} style={{ background: COLOR_HEX[colors.primary] }} />
      </span>
      <span>{t(TURRET_LABELS[turret])} / {t(FRAME_LABELS[frame])}</span>
    </div>
    <PixelButton className="tank-look-open" aria-haspopup="dialog" onClick={() => setOpen(true)}>{t("機体をカスタマイズ")}</PixelButton>
    <dialog ref={dialog} className="tank-look-dialog" aria-labelledby="tank-look-title" onCancel={close} onClick={event => closeOnBackdrop(event, close)}>
      <h2 id="tank-look-title">{t("機体のカスタマイズ")}</h2>
      <PixelButton className="modal-close" aria-label={t("閉じる")} onClick={close}><DotIcon name="close" /></PixelButton>
      {/* 閉じている間は候補の機体を描かない */}
      {open && <div className="tank-look-body">
        <div className="tank-look-preview"><TankPortrait colors={colors} loadout={loadout} /></div>
        <div className="tank-look-options">
          <ColorChoice label={t("カラー1")} value={colors.secondary} pick={secondary => onChange({ ...colors, secondary })} />
          <ColorChoice label={t("カラー2")} value={colors.primary} pick={primary => onChange({ ...colors, primary })} />
          <SkinChoice label={t("砲塔")} options={TURRET_SKINS} labels={TURRET_LABELS} value={turret} loadout={loadout} look={option => ({ ...colors, turret: option })} pick={option => onChange({ ...colors, turret: option })} />
          <SkinChoice label={t("足回り")} options={FRAME_SKINS} labels={FRAME_LABELS} value={frame} loadout={loadout} look={option => ({ ...colors, frame: option })} pick={option => onChange({ ...colors, frame: option })} />
        </div>
      </div>}
      <PixelButton className="tank-look-done" onClick={close}>{t("完了")}</PixelButton>
    </dialog>
  </div>;
};
