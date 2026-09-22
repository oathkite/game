import { useLanguage } from "@/i18n/locale";
import { WEAPON_LABELS } from "@game/protocol";
import { STAGES } from "./stages";
import { nextStageIndex, type Progress } from "./progress";

type Props = {
  readonly progress: Progress;
  readonly saved: boolean;
  readonly onStage: (index: number) => void;
  readonly onFree: () => void;
  readonly onBack: () => void;
};

export const PracticeMenu = ({ progress, saved, onStage, onFree, onBack }: Props) => {
  const { t } = useLanguage();
  const next = nextStageIndex(progress);
  const cleared = STAGES.filter((s) => progress[s.id] !== undefined).length;
  const stage = STAGES[next]!;
  return (
    <main className="menu-shell practice-menu">
      <div className="menu-content practice-content">
        <header><div className="label">PRACTICE</div><h1>{t("プラクティス")}</h1><p className="dim">{t("狙って、崩して、自分のペースで。")}</p></header>
        <section aria-labelledby="challenge-title">
          <div className="practice-heading"><h2 id="challenge-title">{t("ターゲットチャレンジ")}</h2><span>{cleared} / {STAGES.length} CLEAR</span></div>
          <p>{t("限られた弾数で、すべてのターゲットを壊そう。")}</p>
          <button className="primary-action practice-continue" onClick={() => onStage(next)}>{cleared === 0 ? t("ステージ1をはじめる") : cleared === STAGES.length ? t("全ステージクリア！ 記録に挑戦") : t("つづける：{stage}", { stage: `${stage.id} ${t(stage.title)}` })}</button>
          <div className="practice-grid">
            {STAGES.map((s, index) => {
              const unlocked = index === 0 || progress[STAGES[index - 1]!.id] !== undefined || progress[s.id] !== undefined;
              return <button key={s.id} disabled={!unlocked} className={`practice-card${progress[s.id] ? " cleared" : ""}`} onClick={() => onStage(index)} aria-label={`${s.id} ${t(s.title)}${unlocked ? "" : ` ${t("未解放")}`}`}>
                <span className="practice-number">{s.id}</span><strong>{t(s.title)}</strong>
                <span className="dim">{!unlocked ? t("前のステージをクリアで解放") : progress[s.id] ? t("CLEAR · BEST {shots}発", { shots: progress[s.id]! }) : t("{shots}発で挑戦", { shots: s.shots })}</span>
                <span className="practice-weapons">{s.loadout.map((w) => t(WEAPON_LABELS[w])).join(" / ")}</span>
              </button>;
            })}
          </div>
        </section>
        <section className="practice-free"><div><h2>{t("自由練習")}</h2><p className="dim">{t("選んだ武器で、両方の戦車を操作して試そう。")}</p></div><button onClick={onFree}>{t("自由練習をはじめる")}</button></section>
        <p className="dim">{t(saved ? "クリア記録はこのブラウザに保存されます。" : "記録を保存できません。この画面を閉じるまで記録を保持します。")}</p>
      </div>
      <footer className="menu-actions"><button onClick={onBack}>{t("出撃準備へ戻る")}</button></footer>
    </main>
  );
};
