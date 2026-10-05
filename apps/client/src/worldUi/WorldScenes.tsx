import type { CpuLevel } from "@/practice/cpuLevel";
import { PracticeFlow } from "@/practice/PracticeFlow";
import { TutorialScreen } from "@/practice/TutorialScreen";
import { markTutorialSeen, shouldOfferTutorial } from "@/practice/tutorialSeen";
import { resultTitle } from "./resultTitle";
import { DotIcon } from "./DotIcon";
import { closeOnBackdrop } from "@/worldUi/dialogBackdrop";
import { useWorldBrowserBack } from "./browserBack";
import type { ResultPresentation } from "./ResultPlayers";
import { loadScene } from "./loadScene";
import { SceneBoundary } from "./SceneBoundary";
import { AudioControls } from "./AudioControls";
import { LanguageSelect } from "@/i18n/LanguageSelect";
import { useLanguage } from "@/i18n/locale";
import { StartScreen } from "./StartScreen";
import { inviteRoom } from "./roomInvite";
import { loadDisplayScale, saveDisplayScale } from "./displayScale";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { MapName } from "@game/protocol";
import { loadProfile, saveProfile } from "@/app/profile";
import { setAudioActive, setAudioSettings, setMusic, playSound, unlockAudio } from "@/app/audio";
import { CameraSettingsPanel } from "@/prototype/CameraSettingsPanel";
import { createCameraRig } from "@/prototype/cameraRig";
import { PixelButton, PixelPanel } from "./PixelUi";
import { TankCustomizer } from "./TankCustomizer";
import { TankPortrait } from "./TankPortrait";
import { SceneLoading } from "./SceneLoading";
import { SHUTTER_OPEN_MS, shutterDirection, type ShutterDirection } from "./sceneShutter";
import "./worldUi.css";
import "./simpleTheme.css";
import "./pixelTheme.css";
import "./pageLayout.css";
import "./dock.css";

const RoomScreen = lazy(() => loadScene("src/worldUi/RoomScreen.tsx", () => import("./RoomScreen")).then(module => ({ default: module.RoomScreen })));
const NetworkLab = lazy(() => loadScene("src/networkLab/NetworkLab.tsx", () => import("@/networkLab/NetworkLab")).then(module => ({ default: module.NetworkLab })));
const CameraPrototype = lazy(() => loadScene("src/prototype/CameraPrototype.tsx", () => import("@/prototype/CameraPrototype")).then(module => ({ default: module.CameraPrototype })));

const ResultPlayers = lazy(() => loadScene("src/worldUi/ResultPlayers.tsx", () => import("./ResultPlayers")).then(module => ({ default: module.ResultPlayers })));

type Scene = "start" | "lobby" | "battle" | "result" | "network" | "rooms" | "practice" | "tutorial";
export const WorldScenes = () => {
  const { t, language } = useLanguage();
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const [scene, setScene] = useState<Scene>(() => inviteRoom(location.href) || new URL(location.href).searchParams.has("room") ? "rooms" : "start"), [closing, setClosing] = useState(false);
  const [cpuLevel, setCpuLevel] = useState<CpuLevel>("normal");
  const [practiceCpu, setPracticeCpu] = useState(false);
  const [practiceMap, setPracticeMap] = useState<MapName | "random">("ridgeline");
  const [practiceProfile, setPracticeProfile] = useState(loadProfile);
  const [result, setResult] = useState<ResultPresentation | null>(null);
  // 初回だけ「はじめる」からチュートリアルへ入る。保存できない環境でも、同じ画面の中では二度案内しない（設計書 44.1）
  const [tutorial, setTutorial] = useState<{ readonly offer: boolean; readonly fromPractice: boolean }>(() => ({ offer: shouldOfferTutorial(), fromPractice: false }));
  const [direction, setDirection] = useState<ShutterDirection | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const go = useCallback((next: Scene) => {
    if (timer.current) return;
    void unlockAudio();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setScene(next); return; }
    setDirection(shutterDirection(next));
    setClosing(true);
    timer.current = setTimeout(() => { setScene(next); setClosing(false); timer.current = null; }, 400);
  }, []);
  useWorldBrowserBack(scene !== "start", () => go(scene === "lobby" ? "start" : scene === "battle" || scene === "result" || (scene === "tutorial" && tutorial.fromPractice) ? "practice" : "lobby"));
  useEffect(() => { const profile = loadProfile(); setAudioSettings(profile.volume, profile.muted, profile.bgmVolume ?? profile.volume); }, []);
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
    if (scene === "rooms" || scene === "network" || scene === "battle" || scene === "tutorial") return;
    setMusic(scene === "result" && result ? "result" : "hangar");
    if (scene === "result") playSound("matchFinish");
  }, [scene, result]);
  const exitPractice = useCallback(() => { setPracticeProfile(loadProfile()); go("practice"); }, [go]);
  const exit = useCallback(() => go("lobby"), [go]);
  const begin = useCallback(() => {
    if (!tutorial.offer) { go("lobby"); return; }
    markTutorialSeen();
    setTutorial({ offer: false, fromPractice: false });
    go("tutorial");
  }, [go, tutorial.offer]);
  const startTutorial = useCallback(() => { setTutorial({ offer: false, fromPractice: true }); go("tutorial"); }, [go]);
  const finish = useCallback((value: ResultPresentation) => { setResult(value); go("result"); }, [go]);
  return <div className={`world-ui world-scene-${scene} ${closing ? "world-closing" : ""}`}>
    <SceneBoundary message={t("画面を読み込めませんでした。通信を確認して再読み込みしてください。")} retryLabel={t("再読み込み")}>
    <Suspense fallback={<SceneLoading className="scene-loading-page" steps={[{ label: t("画面を読み込み中"), state: "active" }]} />}>
    {scene === "battle" ? <CameraPrototype cpuLevel={cpuLevel} cpu={practiceCpu} worldArt mapName={practiceMap} onExit={exitPractice} onResult={finish} /> : scene === "rooms" ? <RoomScreen onExit={exit} {...(import.meta.env.DEV ? { onLab: () => go("network") } : {})} /> : scene === "network" ? <NetworkLab worldArt onExit={exit} /> : <>
      <div key={scene} ref={heading} tabIndex={-1} className="world-content">
        {scene === "start" && <StartScreen onBegin={begin} />}
        {scene === "tutorial" && <TutorialScreen profile={practiceProfile} fromPractice={tutorial.fromPractice} onExit={tutorial.fromPractice ? exitPractice : exit} />}
        {scene === "practice" && <PracticeFlow profile={practiceProfile} onProfileChange={p => { setPracticeProfile(p); saveProfile(p); setAudioSettings(p.volume, p.muted, p.bgmVolume ?? p.volume); }} onExit={exit} onTutorial={startTutorial} onCpuStart={(map, level) => { setCpuLevel(level); setPracticeCpu(true); setPracticeMap(map); go("battle"); }} onFreeStart={map => { setPracticeCpu(false); setPracticeMap(map); go("battle"); }} />}
        {scene === "lobby" && <Lobby go={go} onPractice={() => { setPracticeProfile(loadProfile()); go("practice"); }} />}
        {scene === "result" && result && <section className="world-result-screen terminal-screen result-terminal"><header className="result-header"><h1>{t(resultTitle(result.result, result.players.find(p => p.playerId === result.ownId)?.teamId))}</h1></header><ResultPlayers {...result} motionDelayMs={SHUTTER_OPEN_MS} /><div className="result-actions"><PixelButton onClick={exitPractice}>{t("プラクティス")}</PixelButton><PixelButton className="result-primary" onClick={() => go("battle")}>{t("もう一度プレイ")}</PixelButton></div></section>}
      </div>
    </>}
    </Suspense>
    </SceneBoundary>
    <div className="world-shutter" data-direction={direction ?? undefined} aria-hidden="true" />
  </div>;
};
const Lobby = ({ go, onPractice }: { readonly go: (scene: Scene) => void; readonly onPractice: () => void }) => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState(loadProfile);
  const update = (patch: Partial<typeof profile>) => { const next = { ...loadProfile(), ...patch }; setProfile(next); saveProfile(next); };
  const settingsDialog = useRef<HTMLDialogElement>(null);
  return <section className="world-lobby">
    <header><PixelButton onClick={() => settingsDialog.current?.showModal()}>{t("設定")}</PixelButton></header>
    <div className="world-machine"><TankPortrait colors={profile.colors} loadout={profile.loadout} /></div>
    <div className="world-loadout">
      <label>{t("名前")}<input aria-label={t("名前")} maxLength={12} value={profile.nickname} placeholder={t("プレイヤー")} onChange={e => update({ nickname: e.target.value })} /></label>

      <TankCustomizer colors={profile.colors} loadout={profile.loadout} onChange={colors => update({ colors })} />
      <PixelButton className="lobby-deploy" onClick={() => go("rooms")}>{t("出撃")}</PixelButton>
      <PixelButton className="lobby-practice" onClick={onPractice}>{t("プラクティス")}</PixelButton>
    </div>
    <dialog ref={settingsDialog} className="lobby-settings" aria-labelledby="lobby-settings-title" onClick={event => closeOnBackdrop(event, () => settingsDialog.current?.close())}>
      <h2 id="lobby-settings-title">{t("整備と設定")}</h2>
      <PixelButton className="modal-close" aria-label={t("閉じる")} onClick={() => settingsDialog.current?.close()}><DotIcon name="close" /></PixelButton>
      <Settings />
    </dialog>

  </section>;
};
const Settings = () => {
  const { t } = useLanguage();
  const [displayScale, setDisplayScale] = useState(loadDisplayScale);
  const [rig] = useState(createCameraRig);
  return <section className="world-settings"><PixelPanel>
    <LanguageSelect />
    <AudioControls />
    {import.meta.env.DEV && new URLSearchParams(location.search).get("debug") === "1" && <CameraSettingsPanel rig={rig} />}
    {import.meta.env.DEV && new URLSearchParams(location.search).get("debug") === "1" && <label>{t("機体の表示サイズ")}<select aria-label={t("機体の表示サイズ")} value={displayScale} onChange={e => { const value = Number(e.target.value); setDisplayScale(value); saveDisplayScale(value); }}><option value={12}>{t("等倍")}</option><option value={9}>{t("0.75倍（標準）")}</option></select></label>}
  </PixelPanel></section>;
};
