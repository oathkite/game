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
  return <dialog ref={dialog} className="battle-menu-panel" aria-label={t("ロビーへ戻りますか？")} onCancel={event => { event.preventDefault(); close(); }}>
    <h2>{t("ロビーへ戻りますか？")}</h2>
    <p>{t(online && playing ? "対戦を離れると降参扱いになります。確認中も対戦は進行します。" : online ? "この部屋から退出します。" : "現在の練習を終了します。")}</p>
    <button autoFocus onClick={close}>{t("対戦に戻る")}</button>
    <button onClick={leave}>{t("ロビーに戻る")}</button>
  </dialog>;
};
