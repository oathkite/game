import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/locale";
import { DotIcon } from "./DotIcon";
import { PixelButton } from "./PixelUi";
import { closeOnBackdrop } from "./dialogBackdrop";
export const RoomPasswordDialog = ({ close, submit }: { readonly close: () => void; readonly submit: (password: string) => void }) => {
  const { t } = useLanguage(); const dialog = useRef<HTMLDialogElement>(null); const [password, setPassword] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="room-filter-dialog" aria-labelledby="room-password-title" onCancel={close} onClick={event => closeOnBackdrop(event, close)}>
    <h2 id="room-password-title">{t("パスワードルーム")}</h2><PixelButton className="modal-close" aria-label={t("閉じる")} onClick={close}><DotIcon name="close" /></PixelButton>
    <form className="room-create-form" onSubmit={event => { event.preventDefault(); submit(password); }}><label>{t("パスワード")}<input type="password" maxLength={64} autoComplete="off" value={password} onChange={event => setPassword(event.target.value)} /></label><PixelButton type="submit" disabled={!password}>{t("入室する")}</PixelButton></form>
  </dialog>;
};
