import { useEffect, useRef, useState } from "react";
import { MULTIPLAYER_MAPS, MULTIPLAYER_MAP_LABELS } from "@game/maps";
import { useLanguage } from "@/i18n/locale";
import { closeOnBackdrop } from "./dialogBackdrop";
import { DotIcon } from "./DotIcon";
import { PixelButton } from "./PixelUi";
import { RoomMapPreview } from "./RoomMapPreview";

// マップはプルダウンではなくサムネイルで選ぶ（設計書 9.4、45.3）。名前だけでは形を思い出せないため。
// 部屋を作るダイアログと、部屋の中（オーナー）で同じ部品を使う。

export const MAP_CHOICES = ["random", ...MULTIPLAYER_MAPS.map(map => map.id)] as const;
export const mapLabel = (mapId: string): string => mapId === "random" ? "ランダム" : MULTIPLAYER_MAP_LABELS[mapId] ?? mapId;

const MapDialog = ({ value, close, select }: { readonly value: string; readonly close: () => void; readonly select: (mapId: string) => void }) => {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="room-filter-dialog room-map-dialog" aria-labelledby="room-map-title" onCancel={close} onClick={event => closeOnBackdrop(event, close)}>
    <h2 id="room-map-title">{t("マップ")}</h2>
    <PixelButton className="modal-close" aria-label={t("閉じる")} onClick={close}><DotIcon name="close" /></PixelButton>
    <ul className="room-map-options">{MAP_CHOICES.map(mapId => <li key={mapId}>
      <button type="button" data-map-id={mapId} aria-pressed={value === mapId} onClick={() => { select(mapId); close(); }}>
        <RoomMapPreview mapId={mapId} /><span>{t(mapLabel(mapId))}</span>
      </button>
    </li>)}</ul>
  </dialog>;
};

/** 今のマップをサムネイルと名前で見せるボタン。押すとサムネイルの一覧が開く */
export const RoomMapField = ({ value, disabled = false, select }: { readonly value: string; readonly disabled?: boolean; readonly select: (mapId: string) => void }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return <>
    <PixelButton type="button" className="room-map-field" data-map-id={value} aria-label={t("マップを変更: {map}", { map: t(mapLabel(value)) })} disabled={disabled} onClick={() => setOpen(true)}>
      <RoomMapPreview mapId={value} /><span>{t(mapLabel(value))}</span><span aria-hidden="true">{t("変更")}</span>
    </PixelButton>
    {open && <MapDialog value={value} close={() => setOpen(false)} select={select} />}
  </>;
};
