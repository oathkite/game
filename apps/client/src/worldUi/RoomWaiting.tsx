import { useEffect, useRef, useState, type ComponentProps } from "react";
import type { RoomSnapshot } from "@game/protocol/v2-rooms";
import { useLanguage } from "@/i18n/locale";
import { closeOnBackdrop } from "./dialogBackdrop";
import { DotIcon } from "./DotIcon";
import { PixelButton } from "./PixelUi";
import { RoomCode } from "./RoomCode";
import { dockAction, RoomDock } from "./RoomDock";
import { copyInvite, RoomInvite, useInviteLink } from "./RoomInviteLink";
import { RoomMapField, mapLabel } from "./RoomMapPicker";
import { RoomMapPreview } from "./RoomMapPreview";
import { RoomMember } from "./RoomMember";
import { RoomTeamSummary } from "./RoomTeamSummary";
import { READY_RESET_MESSAGE, readyWasReset, roomStep, roomStepMessage, type RoomStepMessage } from "./roomStep";
import type { SceneLoading } from "./SceneLoading";
import "./roomFlow.css";

// 部屋の中（設計書 45 章）。見出し、参加者の一覧、マップと編成、ドックの 4 つの領域に分ける。

export type RoomWaitingProps = {
  readonly room: RoomSnapshot; readonly playerId: string; readonly spectator: boolean; readonly connected: boolean; readonly busy: boolean;
  readonly status: string; readonly loading: ComponentProps<typeof SceneLoading>["steps"] | null; readonly waited: boolean;
  readonly base: string; readonly token: string | null;
  readonly edit: (type: string, fields?: object) => void; readonly leave: () => void; readonly resume: () => void;
};

/** マップの列。オーナーはマップを変えられる */
const RoomRules = ({ room, owner, connected, edit }: Pick<RoomWaitingProps, "room" | "connected" | "edit"> & { readonly owner: boolean }) => {
  const { t } = useLanguage();
  const mapId = room.randomMap ? "random" : room.map.id;
  return <aside className="room-wait-aside">
    <div className="room-map-summary">
      {owner && room.mode === "custom"
        ? <RoomMapField value={mapId} disabled={!connected} select={id => edit("room.map", { mapId: id })} />
        : <div className="room-map-current" data-map-id={mapId}><RoomMapPreview mapId={mapId} /><span>{t(mapLabel(mapId))}</span></div>}
      <dl><dt>{t("ターン上限")}</dt><dd>{room.turnLimit === 0 ? t("無制限") : room.turnLimit ?? 12}</dd></dl>
    </div>
  </aside>;
};

/** 2 人以上のときの招待。ダイアログに出し、コピーはダイアログの中で行う */
const InviteDialog = ({ room, base, token, close }: Pick<RoomWaitingProps, "room" | "base" | "token"> & { readonly close: () => void }) => {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null), invite = useInviteLink(base, room.roomId, token);
  const [copied, setCopied] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="room-filter-dialog" aria-labelledby="room-invite-title" onCancel={close} onClick={event => closeOnBackdrop(event, close)}>
    <h2 id="room-invite-title">{t("相手を招待")}</h2>
    <PixelButton className="modal-close" aria-label={t("閉じる")} onClick={close}><DotIcon name="close" /></PixelButton>
    <RoomInvite roomId={room.roomId} invite={invite} copied={copied} codeTestId={false} />
    <PixelButton className="room-create" disabled={!invite.url} onClick={() => { void copyInvite(invite.url).then(setCopied); }}>{t("招待リンクをコピー")}</PixelButton>
  </dialog>;
};

/** 自分で解除していないのに準備完了が外れたことを覚えておく */
const useReadyReset = (ready: boolean | undefined) => {
  const previous = useRef(ready), requested = useRef<boolean | null>(null);
  const [reset, setReset] = useState(false);
  useEffect(() => {
    if (readyWasReset(previous.current, ready, requested.current)) setReset(true);
    if (ready) setReset(false);
    previous.current = ready; requested.current = null;
  }, [ready]);
  return { reset, request: (next: boolean) => { requested.current = next; setReset(false); } };
};

export const RoomWaiting = (props: RoomWaitingProps) => {
  const { room, playerId, spectator, connected, edit } = props;
  const { t } = useLanguage();
  const me = room.members.find(p => p.playerId === playerId), owner = room.ownerId === playerId;
  const step = roomStep(room, playerId, spectator), alone = step.kind === "invite";
  const [inviting, setInviting] = useState(false), [copied, setCopied] = useState("");
  const invite = useInviteLink(props.base, room.roomId, props.token, alone);
  const readyReset = useReadyReset(me?.ready);
  const message: RoomStepMessage = props.status ? { key: props.status, tone: "danger" }
    : readyReset.reset ? { key: READY_RESET_MESSAGE, tone: "wait" }
    : props.waited && step.kind === "quick" ? { key: "対戦相手を待っています。キャンセルして地域を変更するか、出撃準備からプラクティスを開始できます。", tone: "wait" }
    : roomStepMessage(step);
  const action = dockAction(step, { connected, canResume: Boolean(props.token), busy: props.busy, canCopy: Boolean(invite.url), resume: props.resume,
    copy: () => { void copyInvite(invite.url).then(setCopied); }, start: () => edit("room.start"),
    toggleReady: () => { const next = !me?.ready; readyReset.request(next); edit("room.ready", { ready: next }); } });
  return <section className="room-screen terminal-screen room-detail-terminal room-wait" data-step={step.kind}>
    <header className="room-wait-bar">
      <PixelButton className="room-back" onClick={props.leave}>{t(room.mode === "custom" ? "ロビーに戻る" : "待機をキャンセル")}</PixelButton>
      <div className="room-wait-title"><h1>{room.name || t("部屋")}</h1>{!alone && <RoomCode code={room.roomId} />}</div>
      {!alone && !spectator && <PixelButton aria-haspopup="dialog" disabled={Boolean(props.base) && (!me || !connected)} onClick={() => setInviting(true)}>{t("招待リンク")}</PixelButton>}
    </header>
    <section className="room-roster" aria-label={t("参加者")}>
      <div className="room-roster-head"><span>{t("参加者 {count}/8人", { count: room.members.length })}</span><RoomTeamSummary members={room.members} /></div>
      <ul className="room-roster-list">{room.members.map(p => <RoomMember key={p.playerId} member={p} room={room} playerId={playerId} connected={connected} edit={edit} />)}</ul>
      {alone && <RoomInvite roomId={room.roomId} invite={invite} copied={copied} />}
    </section>
    <RoomRules room={room} owner={owner} connected={connected} edit={edit} />
    <RoomDock message={message} loading={props.loading} action={action} />
    {inviting && <InviteDialog room={room} base={props.base} token={props.token} close={() => setInviting(false)} />}
  </section>;
};
