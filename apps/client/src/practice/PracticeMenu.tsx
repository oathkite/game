import { useLanguage } from "@/i18n/locale";

type Props = { readonly onChallenge: () => void; readonly onFree: () => void; readonly onBack: () => void };

export const PracticeMenu = ({ onChallenge, onFree, onBack }: Props) => {
  const { t } = useLanguage();
  return <main className="menu-shell practice-menu practice-mode-menu">
    <div className="menu-content practice-content">
      <header><div className="label">PRACTICE</div><h1>{t("プラクティス")}</h1><p className="dim">{t("練習モードを選んでください。")}</p></header>
      <div className="practice-modes">
        <button className="practice-mode" aria-label={t("ターゲットチャレンジ")} onClick={onChallenge}>
          <strong>{t("ターゲットチャレンジ")}</strong><span>{t("限られた弾数で、すべてのターゲットを壊そう。")}</span>
        </button>
        <button className="practice-mode" aria-label={t("自由練習")} onClick={onFree}>
          <strong>{t("自由練習")}</strong><span>{t("選んだ武器で、両方の戦車を操作して試そう。")}</span>
        </button>
      </div>
    </div>
    <footer className="menu-actions"><button onClick={onBack}>{t("出撃準備へ戻る")}</button></footer>
  </main>;
};
