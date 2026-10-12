import type { Loadout } from "@game/protocol";
import type { RoomSnapshot } from "@game/protocol/v2-rooms";
import { useLanguage } from "@/i18n/locale";
import { DotIcon } from "./DotIcon";
import { memberState } from "./roomStep";
import { RoomTeam } from "./RoomTeam";
import { RoomWeapons } from "./RoomWeapons";
import { TankPortrait } from "./TankPortrait";

type Member = RoomSnapshot["members"][number];

/** 参加者の 1 行。機体、名前、状態、チーム、武器。自分の行（チームはオーナーなら全員）だけが押せる（設計書 45.3） */
export const RoomMember = ({ member, room, playerId, connected, edit }: {
  readonly member: Member; readonly room: RoomSnapshot; readonly playerId: string; readonly connected: boolean;
  readonly edit: (type: string, fields?: object) => void;
}) => {
  const { t } = useLanguage();
  const own = member.playerId === playerId, owner = room.ownerId === playerId;
  const state = memberState(member, room.ownerId);
  return <li className="room-member" data-ready={member.connected && (member.ready || member.playerId === room.ownerId)}>
    <TankPortrait colors={member.colors} loadout={member.loadout} />
    <div className="room-member-identity">
      <span className="room-member-name">{member.nickname}{own ? t("（あなた）") : ""}</span>
      <span className="room-member-state" data-tone={state.tone}>{state.icon && <DotIcon name={state.icon} />}{t(state.key)}</span>
    </div>
    <RoomTeam teamId={member.teamId} editable={room.mode === "custom" && (owner || own)} disabled={!connected} change={teamId => edit("room.assignTeam", { playerId: member.playerId, teamId })} />
    <RoomWeapons loadout={member.loadout} editable={own} disabled={!connected} change={(loadout: Loadout) => edit("room.loadout", { loadout })} />
  </li>;
};
