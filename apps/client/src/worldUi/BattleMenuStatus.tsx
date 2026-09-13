import type { ReactNode } from "react";
import { useLanguage } from "@/i18n/locale";

export const BattleMenuStatus = ({ activeTurn, children }: {
  readonly activeTurn: boolean; readonly children: ReactNode;
}) => {
  const { t } = useLanguage();
  return <div className="battle-menu-progress">
    <div><span>{t("対戦は進行中です。")}</span>
      {activeTurn && <strong className="battle-turn-notice" role="status">{t("あなたの手番です")}</strong>}
    </div>
    <div className="battle-menu-seconds" role="timer" aria-label={t("残り時間")}>{children}</div>
  </div>;
};
