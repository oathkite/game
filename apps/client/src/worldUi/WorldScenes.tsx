import { loadDisplayScale, saveDisplayScale } from "./displayScale";
import { useCallback, useEffect, useRef, useState } from "react";
import { WEAPON_IDS, WEAPON_LABELS, type WeaponId } from "@game/protocol";
import { loadProfile, saveProfile } from "@/app/profile";
import { setAudioSettings, unlockAudio } from "@/app/audio";
import { RoomScreen } from "./RoomScreen";
import { NetworkLab } from "@/networkLab/NetworkLab";
import { CameraPrototype } from "@/prototype/CameraPrototype";
import { CameraSettingsPanel } from "@/prototype/CameraSettingsPanel";
import { createCameraRig } from "@/prototype/cameraRig";
import { PixelButton, PixelPanel } from "./PixelUi";
import { TankPortrait } from "./TankPortrait";
import { WindLeaves } from "./WindLeaves";
import { worldArt } from "./assets";
import "./worldUi.css";

type Scene = "start" | "lobby" | "settings" | "battle" | "result" | "network" | "rooms";
export const WorldScenes = () => {
  const [scene, setScene] = useState<Scene>("start"), [closing, setClosing] = useState(false);
  const [result, setResult] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const go = useCallback((next: Scene) => {
    if (timer.current) return;
    void unlockAudio();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setScene(next); return; }
    setClosing(true);
    timer.current = setTimeout(() => { setScene(next); setClosing(false); timer.current = null; }, 240);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [scene]);
  const exit = useCallback(() => go("lobby"), [go]);
  const finish = useCallback((label: string) => { setResult(label); go("result"); }, [go]);
  const background = scene === "settings" ? worldArt.settings : scene === "lobby" ? worldArt.lobby : scene === "result" ? worldArt.result : worldArt.background;
  return <div className={`world-ui world-scene-${scene} ${closing ? "world-closing" : ""}`} style={{ backgroundImage: `url(${background})` }}>
    {scene === "battle" ? <CameraPrototype worldArt onExit={exit} onResult={finish} /> : scene === "rooms" ? <RoomScreen onExit={exit} onLab={() => go("network")} /> : scene === "network" ? <NetworkLab worldArt onExit={exit} /> : <>
      {scene === "start" && <WindLeaves />}
      <div key={scene} ref={heading} tabIndex={-1} className="world-content">
        {scene === "start" && <section className="world-start"><h1><img className="world-title-logo" src={worldArt.logo} alt="KEROPOD（ケロポッド）" width="1536" height="1024" fetchPriority="high" /></h1><PixelButton onClick={() => go("lobby")}>はじめる</PixelButton><span className="world-build-note">2Dプレビュー</span></section>}
        {scene === "lobby" && <Lobby go={go} />}
        {scene === "settings" && <Settings onBack={exit} />}
        {scene === "result" && <section className="world-result-screen"><h1>{result}</h1><p>いい一発だった。またここで。</p><TankPortrait /><div><PixelButton onClick={() => go("battle")}>もう一度プレイ</PixelButton><PixelButton onClick={exit}>ロビーに戻る</PixelButton></div></section>}
      </div>
    </>}
    <div className="world-shutter" aria-hidden="true" />
  </div>;
};
const Lobby = ({ go }: { readonly go: (scene: Scene) => void }) => {
  const [profile, setProfile] = useState(loadProfile);
  const update = (patch: Partial<typeof profile>) => { const next = { ...profile, ...patch }; setProfile(next); saveProfile(next); };
  const weapon = (slot: 0 | 1, value: WeaponId) => update({ loadout: slot === 0 ? [value, profile.loadout[1]] : [profile.loadout[0], value] });
  return <section className="world-lobby">
    <header><h1>出発の準備</h1><PixelButton onClick={() => go("settings")}>設定</PixelButton></header>
    <div className="world-machine"><TankPortrait /><p>湿地の観測所</p></div>
    <PixelPanel className="world-loadout">
      <label>名前<input aria-label="名前" maxLength={12} value={profile.nickname} placeholder="ケロポッド" onChange={e => update({ nickname: e.target.value })} /></label>
      {([0, 1] as const).map(slot => <label key={slot}>装備 {slot + 1}<select aria-label={`装備 ${slot + 1}`} value={profile.loadout[slot]} onChange={e => weapon(slot, e.target.value as WeaponId)}>{WEAPON_IDS.map(id => <option key={id} value={id} disabled={id === profile.loadout[slot === 0 ? 1 : 0]}>{WEAPON_LABELS[id]}</option>)}</select></label>)}
      <p>装備は対戦ルームにも引き継ぎます。<br />同じ端末で移動と射撃を試せます。</p>
    </PixelPanel>
    <footer><PixelButton onClick={() => go("start")}>タイトルへ</PixelButton><PixelButton onClick={() => go("rooms")}>オンライン試験</PixelButton><PixelButton onClick={() => go("battle")}>プラクティスへ</PixelButton></footer>
  </section>;
};
const Settings = ({ onBack }: { readonly onBack: () => void }) => {
  const [displayScale, setDisplayScale] = useState(loadDisplayScale);
  const [profile, setProfile] = useState(loadProfile), [rig] = useState(createCameraRig);
  const update = (patch: Partial<typeof profile>) => { const next = { ...profile, ...patch }; setProfile(next); saveProfile(next); setAudioSettings(next.volume, next.muted); };
  return <section className="world-settings"><h1>整備と設定</h1><PixelPanel>
    <label>音量 {Math.round(profile.volume * 100)}%<input aria-label="音量" type="range" min="0" max="100" value={profile.volume * 100} onChange={e => update({ volume: Number(e.target.value) / 100 })} /></label>
    <PixelButton onClick={() => update({ muted: !profile.muted })}>{profile.muted ? "音を出す" : "音を消す"}</PixelButton>
    <CameraSettingsPanel rig={rig} />
    <label>機体の表示サイズ<select aria-label="機体の表示サイズ" value={displayScale} onChange={e => { const value = Number(e.target.value); setDisplayScale(value); saveDisplayScale(value); }}><option value={12}>等倍</option><option value={9}>0.75倍（従来）</option></select></label>
    <small>この端末に保存されます。</small>
  </PixelPanel><PixelButton onClick={onBack}>ロビーに戻る</PixelButton></section>;
};
