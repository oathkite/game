import { useEffect, useState, useSyncExternalStore } from "react";
import type { Profile } from "@/app/profile";
import { EMPTY_VIEW } from "@/match/types";
import { LobbyScreen } from "./LobbyScreen";
import { MatchStage } from "./MatchStage";
import { RoomScreen } from "./RoomScreen";
import { SetupScreen } from "./SetupScreen";
import { useOnlineSession } from "./useOnlineSession";

// ロビー → 部屋 → 対戦 → リザルト → 部屋 の流れ。設計書 09 の 9.1。

type Props = {
  readonly profile: Profile;
  readonly onProfileChange: (profile: Profile) => void;
  readonly inviteCode: string | null;
  readonly onExit: () => void;
};

export const OnlineFlow = ({ profile, onProfileChange, inviteCode, onExit }: Props) => {
  const s = useOnlineSession(profile, inviteCode);
  const [editing, setEditing] = useState(false);
  const [resultDismissed, setResultDismissed] = useState(false);
  const view = useSyncExternalStore(
    s.store?.subscribe ?? (() => () => {}),
    s.store?.getView ?? (() => EMPTY_VIEW),
    s.store?.getView ?? (() => EMPTY_VIEW),
  );

  const phase = s.session?.room.phase;
  useEffect(() => {
    if (phase === "inMatch") setResultDismissed(false);
  }, [phase]);

  if (!s.session || !s.store) {
    return (
      <LobbyScreen
        page={s.page}
        query={s.query}
        onQuery={s.updateQuery}
        onCreate={s.actions.createRoom}
        onJoin={s.actions.joinCode}
        onSpectate={s.actions.spectate}
        onBack={onExit}
        error={s.error ?? s.closedReason}
        connected={s.connected}
      />
    );
  }

  const { room, seat, spectator } = s.session;
  const showMatch = room.phase === "inMatch" || (room.phase === "result" && !resultDismissed && view.phase === "finished");

  if (showMatch && view.phase !== "idle") {
    return (
      <MatchStage
        store={s.store}
        clockOffset={s.clockOffset}
        swapPanels={profile.swapPanels}
        closeLabel={spectator ? "閉じる" : "部屋に戻る"}
        onClose={() => {
          setResultDismissed(true);
          if (!spectator) s.store?.closeResult();
        }}
        onLeave={() => {
          setResultDismissed(true);
          s.actions.leave();
        }}
      />
    );
  }

  if (editing) {
    return (
      <SetupScreen
        profile={profile}
        onChange={onProfileChange}
        inviteCode={null}
        onEnterLobby={() => {
          setEditing(false);
          s.actions.updateProfile(profile);
        }}
        onSolo={() => {
          setEditing(false);
        }}
      />
    );
  }

  return (
    <RoomScreen
      room={room}
      mySeat={spectator ? null : seat}
      myColors={profile.colors}
      onReady={s.actions.ready}
      onSetMap={s.actions.setMap}
      onKick={s.actions.kick}
      onStart={s.actions.start}
      onLeave={s.actions.leave}
      onDissolve={s.actions.dissolve}
      onTakeSeat={s.actions.takeSeat}
      onEditProfile={() => setEditing(true)}
      error={s.error}
    />
  );
};
