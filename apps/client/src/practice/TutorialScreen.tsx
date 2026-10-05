import { useLanguage } from "@/i18n/locale";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Profile } from "@/app/profile";
import { setMusic } from "@/app/audio";
import { ChallengeField } from "./ChallengeField";
import { createChallengeStore, type ChallengeStore } from "./store";
import { advanceTutorial, TUTORIAL_STAGE, TUTORIAL_STEPS, type TutorialStep } from "./tutorial";
import type { ChallengeState } from "./challenge";
import "./practice.css";

type Props = {
  readonly profile: Profile;
  /** プラクティスから入ったときは終わりにプラクティスへ、初回は出撃準備へ進む（設計書 44.1） */
  readonly fromPractice: boolean;
  readonly onExit: () => void;
};

/** 「XXX すると YYY できます。XXX してみてください。」の形で、次の操作を一つずつ促す */
const useStepMessage = (step: TutorialStep, touch: boolean): string => {
  const { t } = useLanguage();
  switch (step) {
    case "intro": return t("戦車の動かし方を練習しよう。案内に沿って操作して、最後に的を壊せば完了です。");
    case "aim": return touch ? t("画面左下の▲▼で、砲の角度を変えられます。角度を変えてみてください。") : t("↑↓キーか画面左下の▲▼で、砲の角度を変えられます。角度を変えてみてください。");
    case "move": return touch ? t("◀▶で、戦車が移動します。1回撃つまでに歩ける歩数には限りがあります。動かしてみてください。") : t("←→キーか◀▶で、戦車が移動します。1回撃つまでに歩ける歩数には限りがあります。動かしてみてください。");
    case "weapon": return touch ? t("武器ボタンで、武器を切り替えられます。武器を切り替えてみてください。") : t("Q・Eキーか武器ボタンで、武器を切り替えられます。武器を切り替えてみてください。");
    case "fire": return touch ? t("発射ボタンを押し続けるとパワーがたまり、離すと発射します。撃ってみてください。") : t("スペースキーか発射ボタンを押し続けるとパワーがたまり、離すと発射します。撃ってみてください。");
    case "target": return t("的は右にあります。左右の操作で砲の向きも変わります。角度とパワーを調整して、的を壊してみてください。画面をドラッグすると見回せます。");
    case "done": return t("チュートリアル完了！ 対戦では風と地形も弾道に影響します。プラクティスからいつでも復習できます。");
  }
};

type GuideProps = { readonly step: TutorialStep; readonly failed: boolean; readonly fromPractice: boolean; readonly onNext: () => void; readonly onSkip: () => void; readonly onRetry: () => void };

/** 盤面の下端に重ねるメッセージボックス。操作を促す間はボタンを置かず、Space が発射にだけ効くようにする */
const TutorialGuide = ({ step, failed, fromPractice, onNext, onSkip, onRetry }: GuideProps) => {
  const { t } = useLanguage();
  const [touch] = useState(() => matchMedia("(pointer: coarse)").matches);
  const message = useStepMessage(step, touch);
  const action = useRef<HTMLButtonElement>(null);
  const button = failed ? { label: t("再挑戦"), run: onRetry }
    : step === "intro" ? { label: t("次へ"), run: onNext }
    : step === "done" ? { label: fromPractice ? t("プラクティスへ戻る") : t("出撃準備へ進む"), run: onNext } : null;
  useEffect(() => { action.current?.focus({ preventScroll: true }); }, [step, failed]);
  return <div className="tutorial-slot">
    <section className="tutorial-guide" aria-labelledby="tutorial-guide-title">
      <header>
        <h2 id="tutorial-guide-title">{t("チュートリアル")}<span>{TUTORIAL_STEPS.indexOf(step) + 1}/{TUTORIAL_STEPS.length}</span></h2>
        {step !== "done" && <button className="tutorial-skip" onClick={onSkip}>{t("スキップ")}</button>}
      </header>
      <p aria-live="polite">{failed ? t("弾切れ、または戦車が場外に落ちました。") : message}</p>
      {button && <button ref={action} className="primary-action" onClick={button.run}>{button.label}</button>}
    </section>
  </div>;
};

const TutorialMenu = ({ close, onExit }: { readonly close: () => void; readonly onExit: () => void }) => {
  const { t } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="challenge-modal" aria-label={t("チュートリアル")} onCancel={(e) => { e.preventDefault(); close(); }}>
    <div className="box column">
      <h2>{t("チュートリアル")}</h2>
      <button className="primary-action" onClick={close}>{t("チュートリアルに戻る")}</button>
      <button onClick={onExit}>{t("チュートリアルをやめる")}</button>
    </div>
  </dialog>;
};

type GameProps = Props & { readonly store: ChallengeStore; readonly step: TutorialStep; readonly onStep: (step: TutorialStep) => void; readonly onRetry: () => void };

const TutorialGame = ({ store, step, onStep, fromPractice, onExit, onRetry }: GameProps) => {
  const { t } = useLanguage();
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [menu, setMenu] = useState(false), [started, setStarted] = useState(false);
  // 手順ごとに、始まったときの状態を基準にして促した操作ができたかを判定する
  const from = useRef<ChallengeState>(state);
  const go = useCallback((next: TutorialStep) => { from.current = store.getState(); onStep(next); }, [store, onStep]);
  useEffect(() => { const next = advanceTutorial(step, from.current, state); if (next !== step) go(next); }, [state, step, go]);
  const onReady = useCallback(() => setStarted(true), []);
  const remaining = state.targets.filter(target => !target.destroyed).length;
  const status = <div className="challenge-status"><strong>{t("チュートリアル")}</strong><span>{t("的 {targets}", { targets: remaining })}</span></div>;
  const guide = started && <TutorialGuide step={step} failed={state.status === "failed"} fromPractice={fromPractice} onNext={step === "done" ? onExit : () => go(TUTORIAL_STEPS[TUTORIAL_STEPS.indexOf(step) + 1]!)} onSkip={onExit} onRetry={onRetry} />;
  return <ChallengeField store={store} loadout={TUTORIAL_STAGE.loadout} className={`challenge-game tutorial-game tutorial-step-${started && !menu ? step : "waiting"}`} status={status} guide={guide}
    paused={menu || !started || step === "intro" || step === "done"} onMenu={() => setMenu(true)} onToggleMenu={() => setMenu(v => !v)} onReady={onReady}>
    {menu && <TutorialMenu close={() => setMenu(false)} onExit={onExit} />}
  </ChallengeField>;
};

/** チュートリアル（設計書 44）。場外に落ちたら盤面だけを作り直し、手順はそのまま続ける */
export const TutorialScreen = (props: Props) => {
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState<TutorialStep>("intro");
  // 盤面を作り直したら、手順の基準と開始時の俯瞰も新しいストアでやり直す
  const [field, setField] = useState<{ readonly store: ChallengeStore; readonly attempt: number } | null>(null);
  useEffect(() => { setMusic("ridgeline"); return () => setMusic("hangar"); }, []);
  useEffect(() => {
    setField({ store: createChallengeStore(TUTORIAL_STAGE, props.profile), attempt });
    return () => setField(null);
    // 開始時のプロフィールを使い、やり直しのときだけ作り直す。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  return field ? <TutorialGame key={field.attempt} {...props} store={field.store} step={step} onStep={setStep} onRetry={() => setAttempt(a => a + 1)} /> : null;
};
