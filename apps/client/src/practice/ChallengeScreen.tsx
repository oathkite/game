import { useLanguage } from "@/i18n/locale";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { tiltOf } from "@game/sim";
import type { Profile } from "@/app/profile";
import { BattleConsole, BattleOverlay } from "@/worldUi/BattleHud";
import { BattleTouchControls } from "@/worldUi/BattleTouchControls";
import { useBrowserBackAction } from "@/worldUi/browserBack";
import { createCameraRig } from "@/prototype/cameraRig";
import { cameraLayout } from "@/prototype/camera";
import { PrototypeCanvas } from "@/prototype/PrototypeCanvas";
import { usePrototypeInput } from "@/prototype/usePrototypeInput";
import { setMusic } from "@/app/audio";
import { createChallengeStore, type ChallengeStore } from "./store";
import type { ChallengeStage } from "./stages";
import type { ChallengeState } from "./challenge";
import "@/prototype/prototype.css";

type Props = {
  readonly stage: ChallengeStage;
  readonly profile: Profile;
  readonly onProfileChange: (profile: Profile) => void;
  readonly best: number | undefined;
  readonly onClear: (used: number) => void;
  readonly onBack: () => void;
  readonly onNext: (() => void) | null;
  readonly onRetry: () => void;
};


const ChallengeDialog = ({ state, menu, close, ...props }: Props & { readonly state: ChallengeState; readonly menu: boolean; readonly close: () => void }) => {
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const clear = state.status === "clear";
  return <dialog ref={ref} className="challenge-modal" onCancel={(e) => { e.preventDefault(); if (menu) close(); }} aria-label={t(menu ? "プラクティス設定" : clear ? "クリア" : "再挑戦")}>
    <div className="box column">
      <h2>{t(menu ? "プラクティス" : clear ? "CLEAR!" : "もう一度挑戦しよう")}</h2>
      <p>{menu ? t(props.stage.hint) : clear ? t("{shots}発でクリア", { shots: state.used }) : t("弾切れ、または戦車が場外に落ちました。")}</p>
      {clear && <p>{props.best === undefined || state.used < props.best ? t("自己ベスト更新！") : t("BEST {shots}発", { shots: props.best })}</p>}
      {clear && props.onNext && <button className="primary-action" onClick={props.onNext}>{t("次のステージへ")}</button>}
      {clear && !props.onNext && <p>{t("全8ステージクリア！ 次は最少弾数に挑戦しよう。")}</p>}
      {menu && <label className="row"><input type="checkbox" checked={props.profile.muted} onChange={(e) => props.onProfileChange({ ...props.profile, muted: e.target.checked })} />{t("消音")}</label>}
      {menu && <button className="primary-action" onClick={close}>{t("練習に戻る")}</button>}
      <button onClick={props.onRetry}>{t("もう一度")}</button>
      <button onClick={props.onBack}>{t("ステージ選択へ戻る")}</button>
    </div>
  </dialog>;
};


const openingComplete = () => {};
const ChallengeGame = (props: Props & { readonly store: ChallengeStore }) => {
  const { t } = useLanguage();
  const { store, stage } = props;
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  const [ready, setReady] = useState(false), [menu, setMenu] = useState(false);
  const recorded = useRef(false), initialBest = useRef(props.best);
  const rig = useMemo(createCameraRig, []);
  useEffect(() => {
    const resize = () => setSize({ w: innerWidth, h: innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (state.status === "clear" && !recorded.current) { recorded.current = true; props.onClear(state.used); }
  }, [state.status, state.used, props.onClear]);
  const layout = useMemo(() => ({ ...cameraLayout(size.w, size.h, 4), mapHeight: Math.max(1, size.h - 160) }), [size]);
  const blocked = menu || state.status !== "playing";
  const input = usePrototypeInput(store, rig, ready && state.view.phase === "acting", blocked, () => { if (state.status === "playing") setMenu(v => !v); });
  useBrowserBackAction(true, () => { input.cancel(); setMenu(true); });
  const pose = state.view.control ?? state.view.players![0];
  const remaining = state.targets.filter(t => !t.destroyed).length;
  return <main className="kp-root challenge-game" onContextMenu={e => e.preventDefault()}>
    <BattleOverlay clock={<div className="challenge-status"><strong>{stage.id} {t(stage.title)}</strong><span>{t("的 {targets} · 残り {shots}発", { targets: remaining, shots: stage.shots - state.used })}</span></div>} onMenu={() => { input.cancel(); setMenu(true); }} />
    <PrototypeCanvas store={store} rig={rig} layout={layout} handlers={input.world} blocked={blocked || input.gauge.charging} followShot onReady={setReady} onOpeningComplete={openingComplete} worldArt practice={store} />
    <p className="challenge-hint">{t(stage.hint)}</p>
    <BattleConsole steps={state.view.control?.stepsLeft ?? 0} tilt={tiltOf(state.view.mask!, pose)} elevation={state.view.lastElevation} facing={pose.facing} power={input.gauge.value} loadout={stage.loadout} slot={state.view.lastSlot} disabled={blocked || !ready || state.view.phase !== "acting"} selectSlot={store.selectSlot}>
      <BattleTouchControls disabled={blocked || !ready || state.view.phase !== "acting"} button={input.button} />
    </BattleConsole>
    {blocked && <ChallengeDialog {...props} best={initialBest.current} state={state} menu={menu && state.status === "playing"} close={() => setMenu(false)} />}
  </main>;
};

export const ChallengeScreen = (props: Props) => {
  const [store, setStore] = useState<ChallengeStore | null>(null);
  useEffect(() => {
    setMusic("ridgeline");
    setStore(createChallengeStore(props.stage, props.profile));
    return () => { setStore(null); setMusic("hangar"); };
    // 開始時のプロフィールを使い、記録更新では作り直さない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.stage]);
  return store ? <ChallengeGame {...props} store={store} /> : null;
};
