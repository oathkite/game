import { BattleMenuStatus } from "@/worldUi/BattleMenuStatus";
import { useBrowserBackAction } from "@/worldUi/browserBack";
import { LeaveBattleDialog } from "@/worldUi/LeaveBattleDialog";
import type { ResultPresentation } from "@/worldUi/ResultPlayers";
import { AudioControls } from "@/worldUi/AudioControls";
import { teamColorName } from "@/worldUi/teamColors";
import { useLanguage } from "@/i18n/locale";
import { tiltOf } from "@game/sim";
import { BattleRoster, BattleConsole } from "@/worldUi/BattleHud";
import { useTouchControls } from "@/worldUi/useTouchControls";
import { loadDisplayScale } from "@/worldUi/displayScale";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { WEAPON_LABELS, WEAPON_SLOTS } from "@game/protocol";
import { loadProfile } from "@/app/profile";
import { setAudioSettings, unlockAudio } from "@/app/audio";
import { createLocalConnection, defaultOpponentColors, defaultOpponentLoadout } from "@/net/localConnection";
import { createMatchStore, type MatchStore } from "@/match/matchStore";
import { Timer } from "@/ui/Timer";
import { CameraSettingsPanel } from "./CameraSettingsPanel";
import { cameraLayout } from "./camera";
import { createCameraRig } from "./cameraRig";
import { actorPoint, PrototypeCanvas } from "./PrototypeCanvas";
import { usePrototypeInput } from "./usePrototypeInput";
import "./prototype.css";

type ThemeProps = { readonly worldArt?: boolean; readonly onExit?: () => void; readonly onResult?: (result: ResultPresentation) => void };
export const CameraPrototype = (props: ThemeProps) => {
  const { t } = useLanguage();
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
  return store ? <Battle store={store} {...props} /> : <div>{t("準備しています…")}</div>;
};

const Battle = ({ store, worldArt, onExit, onResult }: { readonly store: MatchStore } & ThemeProps) => {
  const { t } = useLanguage();
  const touch = useTouchControls();
  const view = useSyncExternalStore(store.subscribe, store.getView, store.getView);
  const [size, setSize] = useState({ width: innerWidth, height: innerHeight });
  const [sceneReady, setSceneReady] = useState(false);
  const [menu, setMenu] = useState(false), [followShot, setFollowShot] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const wasMenuOpen = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null), menuButton = useRef<HTMLButtonElement>(null);
  const rig = useMemo(createCameraRig, []);
  const largeHud = size.width >= 1200 && size.height >= 700;
  const hudTop = largeHud ? 76 : 64;
  const hudBottom = touch ? 152 : largeHud ? 160 : size.height < 500 || size.width < 1000 ? 96 : 120;
  const layout = useMemo(() => { const base = cameraLayout(size.width, size.height, worldArt ? loadDisplayScale() : 9); return worldArt ? { ...base, mapHeight: Math.max(1, size.height - hudTop - hudBottom) } : base; }, [size, worldArt, hudTop, hudBottom]);
  const portrait = size.height > size.width;
  const enabled = sceneReady && view.phase === "acting" && view.control !== null && !portrait;
  const input = usePrototypeInput(store, rig, enabled, menu || confirmLeave || portrait, () => { if (confirmLeave) setConfirmLeave(false); else setMenu((open) => !open); });
  useBrowserBackAction(Boolean(worldArt && onExit), () => { input.cancel(); setMenu(false); setConfirmLeave(true); });
  const ready = view.mask !== null && view.players !== null;
  const actor = view.players?.[view.currentSeat], slot = view.control?.slot ?? view.lastSlot;
  useEffect(() => {
    const resize = (): void => setSize({ width: innerWidth, height: innerHeight });
    window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (menu) dialog.current?.showModal();
    else { dialog.current?.close(); if (wasMenuOpen.current) { if (worldArt) dialog.current?.parentElement?.querySelector<HTMLElement>(".kp-canvas")?.focus({ preventScroll: true }); else menuButton.current?.focus({ preventScroll: true }); } }
    wasMenuOpen.current = menu;
  }, [menu, worldArt]);
  useEffect(() => {
    window.__fortress = { store, getView: store.getView, aim: () => null };
    return () => { delete window.__fortress; };
  }, [store]);
  useEffect(() => {
    if (view.phase === "finished" && view.result && view.players && onResult) onResult({
      result: view.result.winner === null ? { type: "draw" } : { type: "win", teamId: `t${view.result.winner}` },
      players: view.players.map(player => ({ playerId: String(player.seat), teamId: `t${player.seat}`, nickname: player.nickname })),
    });
  }, [view.phase, view.result, view.players, onResult]);
  const hudPlayers = view.players?.map(p => ({ id: String(p.seat), name: p.nickname, hp: p.hp, team: p.seat })) ?? [];
  const pose = view.control ?? actor;
  const ground = view.mask && pose ? tiltOf(view.mask, pose) : 0;
  const focusActor = (): void => rig.focus(actorPoint(view), "actor", matchMedia("(prefers-reduced-motion: reduce)").matches);
  return <main className="kp-root" onContextMenu={(e) => e.preventDefault()} onPointerDown={() => unlockAudio()}>
    {worldArt ? <BattleRoster players={hudPlayers} actorId={String(view.currentSeat)} clock={<Timer dial deadlineAt={view.deadlineAt} clockOffset={0} myTurn={enabled} />} wind={view.wind.value} onMenu={() => { input.cancel(); setMenu(true); }} /> : <header className="kp-topbar">
      <div className="kp-brand">KEROPOD <span>{t("プラクティス")}</span></div>
      <div className="kp-turn"><i>{t(teamColorName(view.currentSeat))}</i><strong>{view.phase === "replaying" ? t("弾を見届けよう") : view.phase === "finished" ? t("対戦終了") : t("あなたの番")}</strong><span>{t("次は")} {t(teamColorName(view.currentSeat === 0 ? 1 : 0))}</span></div>
      <div className="kp-wind" aria-label={t("風向き")}><span>{t("風")}</span><div className="kp-wind-window"><b style={{ transform: `translateX(${view.wind.value * 1.5}px) rotate(${view.wind.value * 4}deg)` }}>〰</b></div></div>
      <div className="kp-clock"><Timer deadlineAt={view.deadlineAt} clockOffset={0} myTurn={enabled} /></div>
      <button ref={menuButton} aria-label={t("設定を開く")} onClick={() => { input.cancel(); setMenu(true); }}>{t("設定")}</button>
    </header>}
    {ready ? <PrototypeCanvas worldArt={worldArt ?? false} store={store} rig={rig} layout={layout} handlers={input.world} blocked={menu || confirmLeave || portrait || input.gauge.charging} followShot={followShot} onReady={setSceneReady} /> : <div style={{ height: layout.mapHeight }}>{t("フィールドを準備しています…")}</div>}
    <div className="kp-camera-actions" style={{ bottom: size.height - layout.mapHeight - (worldArt ? hudTop : size.height < 500 || size.width < 1000 ? 44 : 56) + 14 }}>
      <button disabled={input.gauge.charging || menu || confirmLeave || portrait} aria-label={t("手番へ戻る")} onClick={focusActor}>{worldArt ? "◎" : <>{t("手番へ戻る")} <kbd>C</kbd></>}</button>
      <button disabled={input.gauge.charging || menu || confirmLeave || portrait} aria-pressed={followShot} onClick={() => { setFollowShot(!followShot); if (followShot) rig.focus(rig.get().center, "manual", true); }} aria-label={t("弾の追従")}>{worldArt ? "↗" : `${t("弾の追従")} ${followShot ? "ON" : "OFF"}`}</button>
    </div>
    {worldArt ? <BattleConsole player={hudPlayers[view.currentSeat]} steps={view.control?.stepsLeft ?? 0} tilt={ground} elevation={view.control?.elevation ?? view.lastElevation} facing={pose?.facing ?? 1} power={input.gauge.value} loadout={actor?.loadout} slot={slot} disabled={!enabled || confirmLeave || menu || input.gauge.charging} selectSlot={store.selectSlot}>
      {touch && <><div><button aria-label={t("左へ移動")} disabled={!enabled || confirmLeave || menu} {...input.button("left")}>←</button><button aria-label={t("右へ移動")} disabled={!enabled || confirmLeave || menu} {...input.button("right")}>→</button></div><div><button aria-label={t("角度を下げる")} disabled={!enabled || confirmLeave || menu} {...input.button("down")}>−</button><button aria-label={t("角度を上げる")} disabled={!enabled || confirmLeave || menu} {...input.button("up")}>＋</button></div><button aria-label={t("発射")} disabled={!enabled || confirmLeave || menu} {...input.button("fire")}>{t("発射")}</button></>}
    </BattleConsole> : <footer className="kp-controls">
      <div className="kp-control-group"><span>{t("移動")} <small>{view.control?.stepsLeft ?? 0}</small></span><div><button aria-label={t("左へ移動")} disabled={!enabled || confirmLeave || menu} {...input.button("left")}>←</button><button aria-label={t("右へ移動")} disabled={!enabled || confirmLeave || menu} {...input.button("right")}>→</button></div></div>
      <div className="kp-control-group"><span>{t("角度")} <strong data-testid="camera-angle">{view.control?.elevation ?? view.lastElevation}°</strong></span><div><button aria-label={t("角度を下げる")} disabled={!enabled || confirmLeave || menu} {...input.button("down")}>−</button><button aria-label={t("角度を上げる")} disabled={!enabled || confirmLeave || menu} {...input.button("up")}>＋</button></div></div>
      <div className="kp-weapons" aria-label={t("武器")}>{actor && WEAPON_SLOTS.map((s) => <button key={s} aria-pressed={slot === s} disabled={!enabled || confirmLeave || menu || input.gauge.charging} onClick={() => store.selectSlot(s)}>{t(WEAPON_LABELS[actor.loadout[s]])}</button>)}</div>
      <div className="kp-power"><div><span>{t("パワー")}</span><strong>{Math.round(input.gauge.value)}</strong></div><div className="kp-power-track" role="meter" aria-label={t("パワー")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(input.gauge.value)} data-testid="prototype-power"><i style={{ width: `${input.gauge.value}%` }} /></div><small>{t("長押しして、離す")}</small></div>
      <button className="kp-fire" aria-label={t("発射")} disabled={!enabled || confirmLeave || menu} data-testid="prototype-fire" {...input.button("fire")}>{input.gauge.charging ? t("離して発射") : t("発射")}<small>Space</small></button>
    </footer>}
    {confirmLeave && onExit && <LeaveBattleDialog online={false} playing={view.phase !== "finished"} close={() => setConfirmLeave(false)} leave={onExit} />}
    <dialog ref={dialog} className="kp-dialog" onCancel={(e) => { e.preventDefault(); setMenu(false); }}>
      {menu && view.phase !== "finished" && <BattleMenuStatus activeTurn={enabled}>{view.phase === "acting" ? <Timer deadlineAt={view.deadlineAt} clockOffset={0} myTurn={false} /> : "—"}</BattleMenuStatus>}
      <h2>{t("ひと息つこう")}</h2>
      <AudioControls />
      <CameraSettingsPanel rig={rig} />
      <p className="kp-shortcuts">{t("A / D・← / →：移動")}<br />{t("W / S・↑ / ↓：角度　Space：発射")}<br />{t("Q / E：武器　Tab：機体を順に見る")}<br />{t("Shift + 矢印：見回す　C：手番へ")}</p>
      {onResult && <button onClick={() => store.surrender()}>{t("降参して対戦を終える")}</button>}
      <button onClick={() => setMenu(false)}>{t("対戦に戻る")}</button>{onExit ? <button onClick={onExit}>{t("ロビーに戻る")}</button> : <a href="/">{t("ガレージへ戻る")}</a>}
    </dialog>
    {portrait && <div className="kp-portrait"><strong>{t("横向きでプレイしよう")}</strong><p>{t("機体と照準を見やすくするため、端末を回転してください。")}</p>{onExit ? <button onClick={onExit}>{t("ロビーに戻る")}</button> : <a href="/">{t("ガレージへ戻る")}</a>}</div>}
    {view.phase === "finished" && !onResult && <div className="kp-result"><h2>{view.result?.winner === null ? t("引き分け") : t("{player}の勝利", { player: t(teamColorName(view.result?.winner ?? 0)) })}</h2><button onClick={() => store.closeResult()}>{t("もう一度")}</button>{onExit ? <button onClick={onExit}>{t("ロビーに戻る")}</button> : <a href="/">{t("ガレージへ戻る")}</a>}</div>}
  </main>;
};
