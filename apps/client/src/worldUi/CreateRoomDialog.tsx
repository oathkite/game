import { useEffect, useRef, useState } from "react";
import { MULTIPLAYER_MAPS, MULTIPLAYER_MAP_LABELS } from "@game/maps";
import type { CreateRoomOptions } from "@game/protocol/v2-rooms";
import { useLanguage } from "@/i18n/locale";
import { DotIcon } from "./DotIcon";
import { closeOnBackdrop } from "./dialogBackdrop";
import { PixelButton } from "./PixelUi";
export const CreateRoomDialog = ({ region, busy, close, create }: {
  readonly region: CreateRoomOptions["region"]; readonly busy: boolean; readonly close: () => void;
  readonly create: (options: CreateRoomOptions) => void;
}) => {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(""), [password, setPassword] = useState(""), [mapId, setMapId] = useState(MULTIPLAYER_MAPS[0]!.id);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="room-filter-dialog" aria-labelledby="create-room-title" onCancel={close} onClick={event => closeOnBackdrop(event, close)}>
    <h2 id="create-room-title">{t("部屋を作る")}</h2><PixelButton className="modal-close" aria-label={t("閉じる")} onClick={close}><DotIcon name="close" /></PixelButton>
    <form className="room-create-form" onSubmit={event => { event.preventDefault(); create({ name, password, mapId, region }); }}>
      <label>{t("部屋名（任意）")}<input maxLength={32} value={name} onChange={event => setName(event.target.value)} /></label>
      <label>{t("パスワード（任意）")}<input type="password" autoComplete="new-password" maxLength={64} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label>{t("マップ")}<select value={mapId} onChange={event => setMapId(event.target.value)}>{MULTIPLAYER_MAPS.map(map => <option key={map.id} value={map.id}>{t(MULTIPLAYER_MAP_LABELS[map.id] ?? map.id)}</option>)}</select></label>
      <PixelButton className="room-create" type="submit" disabled={busy}>{t("部屋を作る")}</PixelButton>
    </form>
  </dialog>;
};
