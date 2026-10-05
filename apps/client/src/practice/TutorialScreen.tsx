import { useLanguage } from "@/i18n/locale";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Profile } from "@/app/profile";
import { setMusic } from "@/app/audio";
import { Timer } from "@/ui/Timer";
import { useTouchControls } from "@/worldUi/useTouchControls";
import { AudioControls } from "@/worldUi/AudioControls";
import { ChallengeField } from "./ChallengeField";
import { createChallengeStore, type ChallengeStore } from "./store";
import { TURN_LIMIT } from "@game/protocol";
import { nextTutorialStep, observeTutorial, startTutorialStep, TUTORIAL_BUTTON_STEPS, TUTORIAL_STAGE, TUTORIAL_STEPS, tutorialSetup, type TutorialStep } from "./tutorial";
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
    case "intro": return t("戦車の動かし方を練習しよう。案内に沿って操作すると、次へ進みます。");
    case "aim": return touch ? t("画面左下の▲▼で、砲の角度を変えられます。上げる、下げるの両方をやってみてください。") : t("↑↓キーで、砲の角度を変えられます。上げる、下げるの両方をやってみてください。");
    case "move": return touch ? t("◀▶で、戦車が移動して向きも変わります。1回撃つまでに歩ける歩数には限りがあります。左右の両方へ動かしてみてください。") : t("←→キーで、戦車が移動して向きも変わります。1回撃つまでに歩ける歩数には限りがあります。左右の両方へ動かしてみてください。");
    case "weapon": return touch ? t("武器ボタンで、武器を切り替えられます。武器を切り替えてみてください。") : t("Q・Eキーか武器ボタンで、武器を切り替えられます。武器を切り替えてみてください。");
    case "fire": return touch ? t("発射ボタンを押し続けるとパワーがたまり、離すと発射します。撃ってみてください。") : t("スペースキーを押し続けるとパワーがたまり、離すと発射します。撃ってみてください。");
    case "memo": return t("パワーの目盛りを押すと、目安の線を引けます。当たったパワーを覚えておくのに使えます。いま撃ったパワーのあたりを押してみてください。");
    case "target": return t("右に的が出ました。目安の線を目印に角度とパワーを調整して、的を壊してみてください。左右の操作で向きが変わり、画面をドラッグすると見回せます。");
    case "wind": return t("風が吹き始めました。角度メーターの下の風のメーターで、向きと強さが分かります。弾が風に流されるのを、撃って確かめてみてください。");
    case "timer": return t("対戦では、手番ごとに{seconds}秒の制限時間があり、上の時計で残りが分かります。時間内に撃たないと、撃たずに手番が終わります。", { seconds: TURN_LIMIT });
    case "items": return t("武器の上のボタンでアイテムを選べます。ダブルシュートは同じ弾をもう一度撃ち、テレポートは弾が当たった場所へ移ります。1試合に1回ずつ使えます。選んで撃ってみてください。");
    case "done": return t("チュートリアル完了！ プラクティスからいつでも復習できます。");
  }
};

type GuideProps = { readonly step: TutorialStep; readonly failed: boolean; readonly fromPractice: boolean; readonly onNext: () => void; readonly onRetry: () => void };

/** 画面の上の中央に重ねるメッセージボックス。操作を促す間はボタンを置かず、促した操作でだけ進める。Space も発射にだけ効く */
const TutorialGuide = ({ step, failed, fromPractice, onNext, onRetry }: GuideProps) => {
  const { t } = useLanguage();
  // ▲▼◀▶ と発射のボタンは対戦と同じくタッチ端末だけに出すので、文言も同じ判定で切り替える
  const touch = useTouchControls();
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
      <AudioControls />
      <button className="primary-action" onClick={close}>{t("チュートリアルに戻る")}</button>
      <button onClick={onExit}>{t("チュートリアルをやめる")}</button>
    </div>
  </dialog>;
};

/** 状態が変わるたびに 1 つずつ見て、促した操作ができたら次の手順へ進める（上下、左右の両方を見るため、描画ごとではなく変化ごとに見る）。
 * 手順に入ったら、手順から決まる的と風を盤面に出す。go はボタンや目盛りで進めるとき */
const useTutorialProgress = (store: ChallengeStore, step: TutorialStep, onStep: (step: TutorialStep) => void) => {
  const progress = useRef(startTutorialStep(step, store.getState()));
  const go = useCallback((next: TutorialStep) => { progress.current = startTutorialStep(next, store.getState()); onStep(next); }, [store, onStep]);
  useEffect(() => {
    let previous = store.getState();
    return store.subscribe(() => {
      const now = store.getState(), before = progress.current.step;
      progress.current = observeTutorial(progress.current, previous, now);
      previous = now;
      if (progress.current.step !== before) onStep(progress.current.step);
    });
  }, [store, onStep]);
  useEffect(() => {
    const setup = tutorialSetup(step), have = store.getTargets().length;
    if (have < setup.targets.length) store.addTargets(setup.targets.slice(have));
    if (store.getView().wind.value !== setup.wind) store.setWind(setup.wind);
  }, [store, step]);
  return go;
};

/** 制限時間の手順だけ、対戦と同じ時計で TURN_LIMIT 秒を数える。0 になっても失敗にせず、数え直す */
const useDemoDeadline = (active: boolean): number | null => {
  const [deadline, setDeadline] = useState<number | null>(null);
  useEffect(() => {
    if (!active) { setDeadline(null); return; }
    let timer = 0;
    const restart = (): void => { setDeadline(Date.now() + TURN_LIMIT * 1000); timer = window.setTimeout(restart, TURN_LIMIT * 1000 + 1000); };
    restart();
    return () => window.clearTimeout(timer);
  }, [active]);
  return deadline;
};

type GameProps = Props & { readonly store: ChallengeStore; readonly step: TutorialStep; readonly onStep: (step: TutorialStep) => void; readonly onRetry: () => void };

const TutorialGame = ({ store, step, onStep, fromPractice, onExit, onRetry }: GameProps) => {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [menu, setMenu] = useState(false), [started, setStarted] = useState(false);
  const go = useTutorialProgress(store, step, onStep);
  const deadline = useDemoDeadline(step === "timer");
  const onReady = useCallback(() => setStarted(true), []);
  // 目安の線は盤面の状態に残らないので、目盛りを押したことを受けて進める
  const onPowerMemo = (memo: number | null) => { if (memo !== null && step === "memo") go(nextTutorialStep(step)); };
  // 上の中央はふだん空け、制限時間の手順だけ対戦と同じ時計を出す
  const clock = step === "timer" ? <Timer dial deadlineAt={deadline} clockOffset={0} myTurn /> : null;
  // アイテムは、使い切って先へ進めなくならないよう、アイテムの手順の間だけ押せる
  const items = { used: state.view.players?.[0].itemsUsed ?? [], selected: state.view.control?.item ?? null, disabled: step !== "items", select: store.selectItem };
  const guide = started && <TutorialGuide step={step} failed={state.status === "failed"} fromPractice={fromPractice} onNext={step === "done" ? onExit : () => go(nextTutorialStep(step))} onRetry={onRetry} />;
  return <ChallengeField store={store} loadout={TUTORIAL_STAGE.loadout} className={`challenge-game tutorial-game tutorial-step-${started && !menu ? step : "waiting"}`} status={clock} guide={guide} guideRow={false} items={items}
    paused={menu || !started || TUTORIAL_BUTTON_STEPS.includes(step)} onMenu={() => setMenu(true)} onToggleMenu={() => setMenu(v => !v)} onReady={onReady} onPowerMemo={onPowerMemo}>
    {menu && <TutorialMenu close={() => setMenu(false)} onExit={onExit} />}
  </ChallengeField>;
};

/** チュートリアル（設計書 44）。場外に落ちたら盤面だけを作り直し、手順はそのまま続ける。的と風は手順から決めてかけ直す */
export const TutorialScreen = (props: Props) => {
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState<TutorialStep>("intro");
  // 盤面を作り直したら、手順の基準と開始時の俯瞰も新しいストアでやり直す
  const [field, setField] = useState<{ readonly store: ChallengeStore; readonly attempt: number } | null>(null);
  useEffect(() => { setMusic("ridgeline"); return () => setMusic("hangar"); }, []);
  useEffect(() => {
    setField({ store: createChallengeStore(TUTORIAL_STAGE, props.profile, { endless: true, items: true }), attempt });
    return () => setField(null);
    // 開始時のプロフィールを使い、やり直しのときだけ作り直す。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  return field ? <TutorialGame key={field.attempt} {...props} store={field.store} step={step} onStep={setStep} onRetry={() => setAttempt(a => a + 1)} /> : null;
};
