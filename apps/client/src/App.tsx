import type { MapName } from "@game/protocol";
import { useCallback, useEffect, useMemo, useState } from "react";
import { setAudioSettings, unlockAudio } from "./app/audio";
import { loadProfile, saveProfile, type Profile } from "./app/profile";
import { SoloMatch } from "./screens/SoloMatch";
import { SetupScreen } from "./screens/SetupScreen";
import { OnlineFlow } from "./screens/OnlineFlow";

// 画面の切り替え。設定 → ロビー → 部屋 → 対戦 → リザルト、または設定 → solo。

type Route = { readonly kind: "setup" } | { readonly kind: "solo"; readonly mapName: MapName } | { readonly kind: "online" };

const inviteCodeFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("room");
  return code && code.length === 6 ? code.toUpperCase() : null;
};

export const App = () => {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [route, setRoute] = useState<Route>({ kind: "setup" });
  const inviteCode = useMemo(inviteCodeFromUrl, []);

  useEffect(() => {
    saveProfile(profile);
    setAudioSettings(profile.volume, profile.muted);
  }, [profile]);

  // 最初の画面での最初の操作で音声コンテキストを起動する
  useEffect(() => {
    const unlock = (): void => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const toSetup = useCallback(() => setRoute({ kind: "setup" }), []);

  return (
    <>
      <div className="rotate-hint">横向きにしてください</div>
      {route.kind === "setup" && (
        <SetupScreen
          profile={profile}
          onChange={setProfile}
          inviteCode={inviteCode}
          onEnterLobby={() => setRoute({ kind: "online" })}
          onSolo={(mapName) => setRoute({ kind: "solo", mapName })}
        />
      )}
      {route.kind === "solo" && <SoloMatch profile={profile} mapName={route.mapName} onExit={toSetup} />}
      {route.kind === "online" && <OnlineFlow profile={profile} onProfileChange={setProfile} inviteCode={inviteCode} onExit={toSetup} />}
    </>
  );
};
