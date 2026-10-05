import { useLanguage } from "@/i18n/locale";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Profile } from "@/app/profile";
import { setMusic } from "@/app/audio";
import { AudioControls } from "@/worldUi/AudioControls";
import { ChallengeField } from "./ChallengeField";
import { createChallengeStore, type ChallengeStore } from "./store";
import type { ChallengeStage } from "./stages";
import type { ChallengeState } from "./challenge";

type Props = {
  readonly stage: ChallengeStage;
  readonly profile: Profile;
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
      {/* 音の設定は対戦のメニューと同じ部品にする */}
      {menu && <AudioControls />}
      {menu && <button className="primary-action" onClick={close}>{t("練習に戻る")}</button>}
      <button onClick={props.onRetry}>{t("もう一度")}</button>
      <button onClick={props.onBack}>{t("ステージ選択へ戻る")}</button>
    </div>
  </dialog>;
};


const ChallengeGame = (props: Props & { readonly store: ChallengeStore }) => {
  const { t } = useLanguage();
  const { store, stage } = props;
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [menu, setMenu] = useState(false);
  const recorded = useRef(false), initialBest = useRef(props.best);
  useEffect(() => {
    if (state.status === "clear" && !recorded.current) { recorded.current = true; props.onClear(state.used); }
  }, [state.status, state.used, props.onClear]);
  const remaining = state.targets.filter(t => !t.destroyed).length;
  const status = <div className="challenge-status"><strong>{stage.id} {t(stage.title)}</strong><span>{t("的 {targets} · 残り {shots}発", { targets: remaining, shots: stage.shots - state.used })}</span></div>;
  return <ChallengeField store={store} loadout={stage.loadout} className="challenge-game" status={status} guide={<p className="challenge-hint">{t(stage.hint)}</p>} guideRow
    paused={menu} onMenu={() => setMenu(true)} onToggleMenu={() => { if (state.status === "playing") setMenu(v => !v); }}>
    {(menu || state.status !== "playing") && <ChallengeDialog {...props} best={initialBest.current} state={state} menu={menu && state.status === "playing"} close={() => setMenu(false)} />}
  </ChallengeField>;
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
