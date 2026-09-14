import { DotIcon } from "./DotIcon";
import { closeOnBackdrop } from "@/worldUi/dialogBackdrop";
import { useEffect, useRef } from "react";
import { useLanguage } from "@/i18n/locale";

export const LeaveBattleDialog = ({ online, playing, close, leave }: {
  readonly online: boolean; readonly playing: boolean;
  readonly close: () => void; readonly leave: () => void;
}) => {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { previous?.focus({ preventScroll: true }); };
  }, []);
  return <dialog onClick={event => closeOnBackdrop(event, () => close())} ref={dialog} className="battle-menu-panel" aria-label={t(online ? "ロビーへ戻りますか？" : "出撃準備へ戻りますか？")} onCancel={event => { event.preventDefault(); close(); }}>
    <h2>{t(online ? "ロビーへ戻りますか？" : "出撃準備へ戻りますか？")}</h2>
    <p>{t(online && playing ? "対戦を離れると降参扱いになります。確認中も対戦は進行します。" : online ? "この部屋から退出します。" : "現在のプラクティスを終了します。")}</p>
    <button className="modal-close" aria-label={t("閉じる")} autoFocus onClick={close}><DotIcon name="close" /></button>
    <button onClick={leave}>{t(online ? "ロビーに戻る" : "出撃準備に戻る")}</button>
  </dialog>;
};
