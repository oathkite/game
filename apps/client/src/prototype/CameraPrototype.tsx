import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { WEAPON_LABELS, WEAPON_SLOTS } from "@game/protocol";
import { loadProfile } from "@/app/profile";
import { setAudioSettings, unlockAudio } from "@/app/audio";
import { createLocalConnection, defaultOpponentColors, defaultOpponentLoadout } from "@/net/localConnection";
import { createMatchStore, type MatchStore } from "@/match/matchStore";
import { Timer } from "@/ui/Timer";
import { cameraLayout } from "./camera";
import { createCameraRig } from "./cameraRig";
import { actorPoint, PrototypeCanvas } from "./PrototypeCanvas";
import { usePrototypeInput } from "./usePrototypeInput";
import "./prototype.css";

export const CameraPrototype = () => {
  const [store, setStore] = useState<MatchStore | null>(null);
  useEffect(() => {
    const p = loadProfile();
    setAudioSettings(p.volume, p.muted);
    const connection = createLocalConnection({ mapName: "valley", nickname: p.nickname || "ケロポッド", colors: p.colors, loadout: p.loadout,
      opponentColors: defaultOpponentColors(p.colors), opponentLoadout: defaultOpponentLoadout(p.loadout) });
    const created = createMatchStore(connection, { followCurrentSeat: true, mySeat: 0, spectator: false });
    setStore(created);
    return () => { created.dispose(); connection.close(); };
  }, []);
  return store ? <Battle store={store} /> : <div>準備しています…</div>;
};

const Battle = ({ store }: { readonly store: MatchStore }) => {
  const view = useSyncExternalStore(store.subscribe, store.getView, store.getView);
  const [size, setSize] = useState({ width: innerWidth, height: innerHeight });
  const [sceneReady, setSceneReady] = useState(false);
  const [menu, setMenu] = useState(false), [muted, setMuted] = useState(() => loadProfile().muted), [followShot, setFollowShot] = useState(true);
  const wasMenuOpen = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null), menuButton = useRef<HTMLButtonElement>(null);
  const rig = useMemo(createCameraRig, []);
  const layout = useMemo(() => cameraLayout(size.width, size.height), [size]);
  const portrait = size.height > size.width;
  const enabled = sceneReady && view.phase === "acting" && view.control !== null && !portrait;
  const input = usePrototypeInput(store, rig, enabled, menu || portrait, () => setMenu((open) => !open));
  const ready = view.mask !== null && view.players !== null;
  const actor = view.players?.[view.currentSeat], slot = view.control?.slot ?? view.lastSlot;
  useEffect(() => {
    const resize = (): void => setSize({ width: innerWidth, height: innerHeight });
    window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (menu) dialog.current?.showModal();
    else { dialog.current?.close(); if (wasMenuOpen.current) menuButton.current?.focus({ preventScroll: true }); }
    wasMenuOpen.current = menu;
  }, [menu]);
  useEffect(() => {
    window.__fortress = { store, getView: store.getView, aim: () => null };
    return () => { delete window.__fortress; };
  }, [store]);
  const focusActor = (): void => rig.focus(actorPoint(view), "actor", matchMedia("(prefers-reduced-motion: reduce)").matches);
  const toggleMute = (): void => { setMuted(!muted); setAudioSettings(loadProfile().volume, !muted); };
  return <main className="kp-root" onContextMenu={(e) => e.preventDefault()} onPointerDown={() => unlockAudio()}>
    <header className="kp-topbar">
      <div className="kp-brand">KEROPOD <span>プラクティス</span></div>
      <div className="kp-turn"><i>{view.currentSeat === 0 ? "A1" : "B1"}</i><strong>{view.phase === "replaying" ? "弾を見届けよう" : view.phase === "finished" ? "対戦終了" : "あなたの番"}</strong><span>次は {view.currentSeat === 0 ? "B1" : "A1"}</span></div>
      <div className="kp-wind" aria-label="風向き"><span>風</span><div className="kp-wind-window"><b style={{ transform: `translateX(${view.wind.value * 1.5}px) rotate(${view.wind.value * 4}deg)` }}>〰</b></div></div>
      <div className="kp-clock"><Timer deadlineAt={view.deadlineAt} clockOffset={0} myTurn={enabled} /></div>
      <button ref={menuButton} aria-label="設定を開く" onClick={() => { input.cancel(); setMenu(true); }}>設定</button>
    </header>
    {ready ? <PrototypeCanvas store={store} rig={rig} layout={layout} handlers={input.world} blocked={menu || portrait || input.gauge.charging} followShot={followShot} onReady={setSceneReady} /> : <div style={{ height: layout.mapHeight }}>フィールドを準備しています…</div>}
    <div className="kp-camera-actions" style={{ bottom: size.height - layout.mapHeight - (size.height < 500 || size.width < 1000 ? 44 : 56) + 14 }}>
      <button disabled={input.gauge.charging || menu || portrait} onClick={focusActor}>手番へ戻る <kbd>C</kbd></button>
      <button disabled={input.gauge.charging || menu || portrait} aria-pressed={followShot} onClick={() => { setFollowShot(!followShot); if (followShot) rig.focus(rig.get().center, "manual", true); }}>弾の追従 {followShot ? "ON" : "OFF"}</button>
    </div>
    <footer className="kp-controls">
      <div className="kp-control-group"><span>移動 <small>{view.control?.stepsLeft ?? 0}</small></span><div><button aria-label="左へ移動" disabled={!enabled || menu} {...input.button("left")}>←</button><button aria-label="右へ移動" disabled={!enabled || menu} {...input.button("right")}>→</button></div></div>
      <div className="kp-control-group"><span>角度 <strong data-testid="camera-angle">{view.control?.elevation ?? view.lastElevation}°</strong></span><div><button aria-label="角度を下げる" disabled={!enabled || menu} {...input.button("down")}>−</button><button aria-label="角度を上げる" disabled={!enabled || menu} {...input.button("up")}>＋</button></div></div>
      <div className="kp-weapons" aria-label="武器">{actor && WEAPON_SLOTS.map((s) => <button key={s} aria-pressed={slot === s} disabled={!enabled || menu || input.gauge.charging} onClick={() => store.selectSlot(s)}>{WEAPON_LABELS[actor.loadout[s]]}</button>)}</div>
      <div className="kp-power"><div><span>パワー</span><strong>{Math.round(input.gauge.value)}</strong></div><div className="kp-power-track" role="meter" aria-label="パワー" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(input.gauge.value)} data-testid="prototype-power"><i style={{ width: `${input.gauge.value}%` }} /></div><small>長押しして、離す</small></div>
      <button className="kp-fire" aria-label="発射" disabled={!enabled || menu} data-testid="prototype-fire" {...input.button("fire")}>{input.gauge.charging ? "離して発射" : "発射"}<small>Space</small></button>
    </footer>
    <dialog ref={dialog} className="kp-dialog" onCancel={(e) => { e.preventDefault(); setMenu(false); }}>
      <h2>ひと息つこう</h2><p>プラクティスは進行中です。</p>
      <button aria-pressed={muted} onClick={toggleMute}>サウンド {muted ? "OFF" : "ON"}</button>
      <p className="kp-shortcuts">A / D：移動<br />↑ / ↓：角度　Space：発射<br />Shift + 矢印：見回す　C：手番へ</p>
      <button onClick={() => setMenu(false)}>対戦に戻る</button><a href="/">ガレージへ戻る</a>
    </dialog>
    {portrait && <div className="kp-portrait"><strong>横向きでプレイしよう</strong><p>機体と照準を見やすくするため、端末を回転してください。</p><a href="/">ガレージへ戻る</a></div>}
    {view.phase === "finished" && <div className="kp-result"><h2>{view.result?.winner === null ? "引き分け" : `${view.result?.winner === 0 ? "A1" : "B1"}の勝利`}</h2><button onClick={() => store.closeResult()}>もう一度</button><a href="/">ガレージへ戻る</a></div>}
  </main>;
};
