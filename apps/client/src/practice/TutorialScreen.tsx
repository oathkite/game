import { useLanguage } from "@/i18n/locale";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Profile } from "@/app/profile";
import { setMusic } from "@/app/audio";
import { ChallengeField } from "./ChallengeField";
import { createChallengeStore, type ChallengeStore } from "./store";
import { TURN_LIMIT } from "@game/protocol";
import { advanceTutorial, nextTutorialStep, TUTORIAL_BUTTON_STEPS, TUTORIAL_STAGE, TUTORIAL_STEPS, type TutorialStep } from "./tutorial";
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
    case "intro": return t("戦車の動かし方を練習しよう。案内に沿って操作して、的を壊したら対戦で知っておくことを確かめます。");
    case "aim": return touch ? t("画面左下の▲▼で、砲の角度を変えられます。角度を変えてみてください。") : t("↑↓キーか画面左下の▲▼で、砲の角度を変えられます。角度を変えてみてください。");
    case "move": return touch ? t("◀▶で、戦車が移動します。1回撃つまでに歩ける歩数には限りがあります。動かしてみてください。") : t("←→キーか◀▶で、戦車が移動します。1回撃つまでに歩ける歩数には限りがあります。動かしてみてください。");
    case "weapon": return touch ? t("武器ボタンで、武器を切り替えられます。武器を切り替えてみてください。") : t("Q・Eキーか武器ボタンで、武器を切り替えられます。武器を切り替えてみてください。");
    case "memo": return t("パワーの目盛りを押すと、目安の線を引けます。当たったパワーを覚えておくのに使えます。目盛りを押してみてください。");
    case "fire": return touch ? t("発射ボタンを押し続けるとパワーがたまり、離すと発射します。目安の線を目印に、撃ってみてください。") : t("スペースキーか発射ボタンを押し続けるとパワーがたまり、離すと発射します。目安の線を目印に、撃ってみてください。");
    case "target": return t("的は右にあります。左右の操作で砲の向きも変わります。角度とパワーを調整して、的を壊してみてください。画面をドラッグすると見回せます。");
    case "wind": return t("対戦では風が吹き、弾が流されます。角度メーターの下にある風のメーターで、向きと強さを確かめてから狙いましょう。");
    case "timer": return t("対戦では、1回の手番に{seconds}秒の制限時間があります。時間内に撃たないと、撃たずに手番が終わります。", { seconds: TURN_LIMIT });
    case "items": return t("対戦では、アイテムを1試合に1回ずつ使えます。ダブルシュートは同じ弾をもう一度撃ち、テレポートは弾が当たった場所へ移ります。撃つ前に、武器の上のボタンで選びます。");
    case "done": return t("チュートリアル完了！ プラクティスからいつでも復習できます。");
  }
};

type GuideProps = { readonly step: TutorialStep; readonly failed: boolean; readonly fromPractice: boolean; readonly onNext: () => void; readonly onRetry: () => void };

/** 画面の上の中央に重ねるメッセージボックス。操作を促す間はボタンを置かず、促した操作でだけ進める。Space も発射にだけ効く */
const TutorialGuide = ({ step, failed, fromPractice, onNext, onRetry }: GuideProps) => {
  const { t } = useLanguage();
  const [touch] = useState(() => matchMedia("(pointer: coarse)").matches);
  const message = useStepMessage(step, touch);
  const action = useRef<HTMLButtonElement>(null);
  const button = failed ? { label: t("再挑戦"), run: onRetry }
    : step === "done" ? { label: fromPractice ? t("プラクティスへ戻る") : t("出撃準備へ進む"), run: onNext }
    : TUTORIAL_BUTTON_STEPS.includes(step) ? { label: t("次へ"), run: onNext } : null;
  useEffect(() => { action.current?.focus({ preventScroll: true }); }, [step, failed]);
  return <section className="tutorial-guide" aria-label={t("チュートリアル")}>
    <p aria-live="polite">{failed ? t("弾切れ、または戦車が場外に落ちました。") : message}</p>
    <footer>
      <span className="tutorial-progress">{TUTORIAL_STEPS.indexOf(step) + 1}/{TUTORIAL_STEPS.length}</span>
      {button && <button ref={action} className="primary-action" onClick={button.run}>{button.label}</button>}
    </footer>
  </section>;
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
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [menu, setMenu] = useState(false), [started, setStarted] = useState(false);
  // 手順ごとに、始まったときの状態を基準にして促した操作ができたかを判定する
  const from = useRef<ChallengeState>(state);
  const go = useCallback((next: TutorialStep) => { from.current = store.getState(); onStep(next); }, [store, onStep]);
  useEffect(() => { const next = advanceTutorial(step, from.current, state); if (next !== step) go(next); }, [state, step, go]);
  const onReady = useCallback(() => setStarted(true), []);
  // 目安の線は盤面の状態に残らないので、目盛りを押したことを受けて進める
  const onPowerMemo = (memo: number | null) => { if (memo !== null && step === "memo") go(nextTutorialStep(step)); };
  // 案内はメッセージボックスに任せ、上の中央（チャレンジの面の名前と残りの数の場所）には何も出さない。下の枠はヒントの行の高さを保つ
  const guide = <>
    {started && <TutorialGuide step={step} failed={state.status === "failed"} fromPractice={fromPractice} onNext={step === "done" ? onExit : () => go(nextTutorialStep(step))} onRetry={onRetry} />}
    <div className="tutorial-slot" aria-hidden="true" />
  </>;
  return <ChallengeField store={store} loadout={TUTORIAL_STAGE.loadout} className={`challenge-game tutorial-game tutorial-step-${started && !menu ? step : "waiting"}`} status={null} guide={guide}
    paused={menu || !started || TUTORIAL_BUTTON_STEPS.includes(step)} onMenu={() => setMenu(true)} onToggleMenu={() => setMenu(v => !v)} onReady={onReady} onPowerMemo={onPowerMemo}>
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
