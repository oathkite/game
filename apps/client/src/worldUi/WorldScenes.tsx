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
import { WEAPON_DELAY, MAP_LABELS, type MapName, WEAPON_IDS, WEAPON_LABELS, PLAYER_COLORS, COLOR_HEX, type WeaponId } from "@game/protocol";
import { loadProfile, saveProfile } from "@/app/profile";
import { setAudioActive, setAudioSettings, setMusic, playSound, unlockAudio } from "@/app/audio";
import { CameraSettingsPanel } from "@/prototype/CameraSettingsPanel";
import { createCameraRig } from "@/prototype/cameraRig";
import { PixelButton, PixelPanel } from "./PixelUi";
import { TankPortrait } from "./TankPortrait";
import "./worldUi.css";
import "./simpleTheme.css";
import "./pageLayout.css";
import "./dock.css";

const RoomScreen = lazy(() => loadScene("src/worldUi/RoomScreen.tsx", () => import("./RoomScreen")).then(module => ({ default: module.RoomScreen })));
const NetworkLab = lazy(() => loadScene("src/networkLab/NetworkLab.tsx", () => import("@/networkLab/NetworkLab")).then(module => ({ default: module.NetworkLab })));
const CameraPrototype = lazy(() => loadScene("src/prototype/CameraPrototype.tsx", () => import("@/prototype/CameraPrototype")).then(module => ({ default: module.CameraPrototype })));

const ResultPlayers = lazy(() => loadScene("src/worldUi/ResultPlayers.tsx", () => import("./ResultPlayers")).then(module => ({ default: module.ResultPlayers })));

type Scene = "start" | "lobby" | "battle" | "result" | "network" | "rooms";
export const WorldScenes = () => {
  const { t, language } = useLanguage();
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const [scene, setScene] = useState<Scene>(() => inviteRoom(location.href) || new URL(location.href).searchParams.has("room") ? "rooms" : "start"), [closing, setClosing] = useState(false);
  const [practiceMap, setPracticeMap] = useState<MapName | "random">("ridgeline");
  const [result, setResult] = useState<ResultPresentation | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const go = useCallback((next: Scene) => {
    if (timer.current) return;
    void unlockAudio();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setScene(next); return; }
    setClosing(true);
    timer.current = setTimeout(() => { setScene(next); setClosing(false); timer.current = null; }, 400);
  }, []);
  useWorldBrowserBack(scene !== "start", () => go(scene === "lobby" ? "start" : "lobby"));
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
    if (scene === "rooms" || scene === "network" || scene === "battle") return;
    setMusic(scene === "result" && result ? "result" : "hangar");
    if (scene === "result") playSound("matchFinish");
  }, [scene, result]);
  const exit = useCallback(() => go("lobby"), [go]);
  const finish = useCallback((value: ResultPresentation) => { setResult(value); go("result"); }, [go]);
  return <div className={`world-ui world-scene-${scene} ${closing ? "world-closing" : ""}`}>
    <SceneBoundary message={t("画面を読み込めませんでした。通信を確認して再読み込みしてください。")} retryLabel={t("再読み込み")}>
    <Suspense fallback={<p role="status">{t("フィールドを準備しています…")}</p>}>
    {scene === "battle" ? <CameraPrototype worldArt mapName={practiceMap} onExit={exit} onResult={finish} /> : scene === "rooms" ? <RoomScreen onExit={exit} {...(import.meta.env.DEV ? { onLab: () => go("network") } : {})} /> : scene === "network" ? <NetworkLab worldArt onExit={exit} /> : <>
      <div key={scene} ref={heading} tabIndex={-1} className="world-content">
        {scene === "start" && <StartScreen onBegin={() => go("lobby")} />}
        {scene === "lobby" && <Lobby go={go} practiceMap={practiceMap} setPracticeMap={setPracticeMap} />}
        {scene === "result" && result && <section className="world-result-screen terminal-screen result-terminal"><header className="result-header"><h1>{t(resultTitle(result.result, result.players.find(p => p.playerId === result.ownId)?.teamId))}</h1></header><ResultPlayers {...result} /><div className="result-actions"><PixelButton onClick={exit}>{t("出撃準備")}</PixelButton><PixelButton className="result-primary" onClick={() => go("battle")}>{t("もう一度プレイ")}</PixelButton></div></section>}
      </div>
    </>}
    </Suspense>
    </SceneBoundary>
    <div className="world-shutter" aria-hidden="true" />
  </div>;
};
const Lobby = ({ go, practiceMap, setPracticeMap }: { readonly go: (scene: Scene) => void; readonly practiceMap: MapName | "random"; readonly setPracticeMap: (map: MapName | "random") => void }) => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState(loadProfile);
  const update = (patch: Partial<typeof profile>) => { const next = { ...loadProfile(), ...patch }; setProfile(next); saveProfile(next); };
  const practiceDialog = useRef<HTMLDialogElement>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const weapon = (slot: 0 | 1, value: WeaponId) => update({ loadout: slot === 0 ? [value, profile.loadout[1]] : [profile.loadout[0], value] });
  return <section className="world-lobby">
    <header><PixelButton onClick={() => settingsDialog.current?.showModal()}>{t("設定")}</PixelButton></header>
    <div className="world-machine"><TankPortrait colors={profile.colors} /></div>
    <div className="world-loadout">
      <label>{t("名前")}<input aria-label={t("名前")} maxLength={12} value={profile.nickname} placeholder={t("プレイヤー")} onChange={e => update({ nickname: e.target.value })} /></label>

      <div className="tank-colors">{(["primary", "secondary"] as const).map(part => <fieldset key={part}><legend>{t(part === "primary" ? "車体色" : "砲塔色")}</legend><div role="radiogroup" aria-label={t(part === "primary" ? "車体色" : "砲塔色")}>
        {PLAYER_COLORS.map(color => <button type="button" role="radio" aria-label={color} aria-checked={profile.colors[part] === color} key={color} onClick={() => update({ colors: { ...profile.colors, [part]: color } })}><i style={{ background: COLOR_HEX[color] }} /></button>)}
      </div></fieldset>)}</div>
      <PixelButton className="lobby-deploy" onClick={() => go("rooms")}>{t("出撃")}</PixelButton>
      <PixelButton className="lobby-practice" onClick={() => practiceDialog.current?.showModal()}>{t("プラクティス")}</PixelButton>
    </div>
    <dialog ref={settingsDialog} className="lobby-settings" aria-labelledby="lobby-settings-title" onClick={event => closeOnBackdrop(event, () => settingsDialog.current?.close())}>
      <h2 id="lobby-settings-title">{t("整備と設定")}</h2>
      <PixelButton className="modal-close" aria-label={t("閉じる")} onClick={() => settingsDialog.current?.close()}><DotIcon name="close" /></PixelButton>
      <Settings />
    </dialog>
    <dialog onClick={event => closeOnBackdrop(event, () => practiceDialog.current?.close())} ref={practiceDialog} className="practice-settings" aria-labelledby="practice-settings-title">
      <h2 id="practice-settings-title">{t("プラクティス設定")}</h2>
      <label>{t("ステージ")}<select aria-label={t("ステージ")} value={practiceMap} onChange={e => setPracticeMap(e.target.value as MapName | "random")}><option value="random">{t("ランダム")}</option>{(["ridgeline", "stone-bridge", "terraces", "sky-islands"] as const).map(map => <option key={map} value={map}>{t(MAP_LABELS[map])}</option>)}</select></label>
      {([0, 1] as const).map(slot => <label key={slot}>{t("装備")} {slot + 1}<select aria-label={`${t("装備")} ${slot + 1}`} value={profile.loadout[slot]} onChange={e => weapon(slot, e.target.value as WeaponId)}>{WEAPON_IDS.map(id => <option key={id} value={id} disabled={id === profile.loadout[slot === 0 ? 1 : 0]}>{t(WEAPON_LABELS[id])} · {t("コスト")} {WEAPON_DELAY[id]}</option>)}</select></label>)}
      <div className="practice-settings-actions"><PixelButton className="modal-close" aria-label={t("閉じる")} onClick={() => practiceDialog.current?.close()}><DotIcon name="close" /></PixelButton><PixelButton className="practice-start" onClick={() => { practiceDialog.current?.close(); go("battle"); }}>{t("プラクティス開始")}</PixelButton></div>
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
