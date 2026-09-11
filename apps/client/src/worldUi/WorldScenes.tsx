import type { ResultPresentation } from "./ResultPlayers";
import { teamColorName } from "./teamColors";
import { loadScene } from "./loadScene";
import { SceneBoundary } from "./SceneBoundary";
import { AudioControls } from "./AudioControls";
import { LanguageSelect } from "@/i18n/LanguageSelect";
import { useLanguage } from "@/i18n/locale";
import { StartScreen } from "./StartScreen";
import { inviteRoom } from "./roomInvite";
import { loadDisplayScale, saveDisplayScale } from "./displayScale";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { WEAPON_IDS, WEAPON_LABELS, type WeaponId } from "@game/protocol";
import { loadProfile, saveProfile } from "@/app/profile";
import { setAudioActive, setAudioSettings, setMusic, playSound, unlockAudio } from "@/app/audio";
import { CameraSettingsPanel } from "@/prototype/CameraSettingsPanel";
import { createCameraRig } from "@/prototype/cameraRig";
import { PixelButton, PixelPanel } from "./PixelUi";
import { TankPortrait } from "./TankPortrait";
import { WindLeaves } from "./WindLeaves";
import { worldArt } from "./assets";
import "./worldUi.css";

const RoomScreen = lazy(() => loadScene("src/worldUi/RoomScreen.tsx", () => import("./RoomScreen")).then(module => ({ default: module.RoomScreen })));
const NetworkLab = lazy(() => loadScene("src/networkLab/NetworkLab.tsx", () => import("@/networkLab/NetworkLab")).then(module => ({ default: module.NetworkLab })));
const CameraPrototype = lazy(() => loadScene("src/prototype/CameraPrototype.tsx", () => import("@/prototype/CameraPrototype")).then(module => ({ default: module.CameraPrototype })));

const ResultPlayers = lazy(() => loadScene("src/worldUi/ResultPlayers.tsx", () => import("./ResultPlayers")).then(module => ({ default: module.ResultPlayers })));

type Scene = "start" | "lobby" | "settings" | "battle" | "result" | "network" | "rooms";
export const WorldScenes = () => {
  const { t, language } = useLanguage();
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const [scene, setScene] = useState<Scene>(() => inviteRoom(location.href) || new URL(location.href).searchParams.has("room") ? "rooms" : "start"), [closing, setClosing] = useState(false);
  const [introReplay, setIntroReplay] = useState(0);
  const [result, setResult] = useState<ResultPresentation | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const go = useCallback((next: Scene) => {
    if (timer.current) return;
    if (next !== "start") setIntroReplay(0);
    void unlockAudio();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setScene(next); return; }
    setClosing(true);
    timer.current = setTimeout(() => { setScene(next); setClosing(false); timer.current = null; }, 240);
  }, []);
  useEffect(() => { const profile = loadProfile(); setAudioSettings(profile.volume, profile.muted); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [scene]);
  useEffect(() => {
    const unlock = () => unlockAudio();
    const visibility = () => setAudioActive(!document.hidden);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", visibility);
      setMusic(null);
    };
  }, []);
  useEffect(() => {
    // Online scenes own their music because their internal phase changes independently.
    if (scene === "rooms" || scene === "network") return;
    setMusic(scene === "start" ? "title" : scene === "battle" ? "battle" : scene === "result" ? "result" : "lobby");
    if (scene === "result") playSound("matchFinish");
  }, [scene]);
  const exit = useCallback(() => go("lobby"), [go]);
  const finish = useCallback((value: ResultPresentation) => { setResult(value); go("result"); }, [go]);
  const background = scene === "settings" ? worldArt.settings : scene === "lobby" ? worldArt.lobby : scene === "result" ? worldArt.result : worldArt.background;
  return <div className={`world-ui world-scene-${scene} ${closing ? "world-closing" : ""}`} style={{ backgroundImage: `url(${background})` }}>
    <SceneBoundary message={t("画面を読み込めませんでした。通信を確認して再読み込みしてください。")} retryLabel={t("再読み込み")}>
    <Suspense fallback={<p role="status">{t("フィールドを準備しています…")}</p>}>
    {scene === "battle" ? <CameraPrototype worldArt onExit={exit} onResult={finish} /> : scene === "rooms" ? <RoomScreen onExit={exit} {...(import.meta.env.DEV ? { onLab: () => go("network") } : {})} /> : scene === "network" ? <NetworkLab worldArt onExit={exit} /> : <>
      {scene === "start" && <WindLeaves />}
      <div key={scene} ref={heading} tabIndex={-1} className="world-content">
        {scene === "start" && <StartScreen key={introReplay} replay={introReplay > 0} onBegin={() => go("lobby")} />}
        {scene === "lobby" && <Lobby go={go} />}
        {scene === "settings" && <Settings onBack={exit} onReplay={() => { setIntroReplay(value => value + 1); go("start"); }} />}
        {scene === "result" && result && <section className="world-result-screen"><h1>{result.result.type === "win" ? t("{player}の勝利", { player: t(teamColorName(Number(result.result.teamId.slice(1)))) }) : t("引き分け")}</h1><p>{t("いい一発だった。またここで。")}</p><ResultPlayers {...result} /><div><PixelButton onClick={() => go("battle")}>{t("もう一度プレイ")}</PixelButton><PixelButton onClick={exit}>{t("ロビーに戻る")}</PixelButton></div></section>}
      </div>
    </>}
    </Suspense>
    </SceneBoundary>
    <div className="world-shutter" aria-hidden="true" />
  </div>;
};
const Lobby = ({ go }: { readonly go: (scene: Scene) => void }) => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState(loadProfile);
  const update = (patch: Partial<typeof profile>) => { const next = { ...profile, ...patch }; setProfile(next); saveProfile(next); };
  const weapon = (slot: 0 | 1, value: WeaponId) => update({ loadout: slot === 0 ? [value, profile.loadout[1]] : [profile.loadout[0], value] });
  return <section className="world-lobby">
    <header><h1>{t("出発の準備")}</h1><PixelButton onClick={() => go("settings")}>{t("設定")}</PixelButton></header>
    <div className="world-machine"><TankPortrait /><p>{t("湿地の観測所")}</p></div>
    <PixelPanel className="world-loadout">
      <label>{t("名前")}<input aria-label={t("名前")} maxLength={12} value={profile.nickname} placeholder={t("ケロポッド")} onChange={e => update({ nickname: e.target.value })} /></label>
      {([0, 1] as const).map(slot => <label key={slot}>{t("装備")} {slot + 1}<select aria-label={`${t("装備")} ${slot + 1}`} value={profile.loadout[slot]} onChange={e => weapon(slot, e.target.value as WeaponId)}>{WEAPON_IDS.map(id => <option key={id} value={id} disabled={id === profile.loadout[slot === 0 ? 1 : 0]}>{t(WEAPON_LABELS[id])}</option>)}</select></label>)}
    </PixelPanel>
    <footer><PixelButton onClick={() => go("start")}>{t("タイトルへ")}</PixelButton><PixelButton onClick={() => go("rooms")}>{t("オンライン対戦")}</PixelButton><PixelButton onClick={() => go("battle")}>{t("プラクティスへ")}</PixelButton></footer>
  </section>;
};
const Settings = ({ onBack, onReplay }: { readonly onBack: () => void; readonly onReplay: () => void }) => {
  const { t } = useLanguage();
  const [displayScale, setDisplayScale] = useState(loadDisplayScale);
  const [rig] = useState(createCameraRig);
  return <section className="world-settings"><h1>{t("整備と設定")}</h1><PixelPanel>
    <LanguageSelect />
    <AudioControls />
    <CameraSettingsPanel rig={rig} />
    <label>{t("機体の表示サイズ")}<select aria-label={t("機体の表示サイズ")} value={displayScale} onChange={e => { const value = Number(e.target.value); setDisplayScale(value); saveDisplayScale(value); }}><option value={12}>{t("等倍")}</option><option value={9}>{t("0.75倍（従来）")}</option></select></label>
    <PixelButton onClick={onReplay}>{t("イントロを再生")}</PixelButton>
    <small>{t("この端末に保存されます。")}</small>
  </PixelPanel><PixelButton onClick={onBack}>{t("ロビーに戻る")}</PixelButton></section>;
};
