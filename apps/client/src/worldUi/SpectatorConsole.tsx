import type { ReactNode } from "react";
import { useLanguage } from "@/i18n/locale";

/** 手番の参加者。名前はチームの色で出す（設計書 03 の 3.7） */
export type SpectatorActor = { readonly name: string; readonly color: string };

/**
 * 観戦者と脱落した参加者の操作盤の代わりに出す帯（設計書 21.4）。
 * 「観戦中」、誰の番か、手動視点を維持するかの切り替え、風のメーターを、操作盤と同じ高さの帯に並べる
 */
export const SpectatorConsole = ({ actor, keepView, onKeepView, wind }: { readonly actor: SpectatorActor | null; readonly keepView: boolean; readonly onKeepView: (keep: boolean) => void; readonly wind: ReactNode }) => {
  const { t } = useLanguage();
  return <footer className="battle-console battle-spectator" data-testid="spectator-console">
    <span role="status">{t("観戦中")}</span>
    <div className="battle-spectator-center">
      {actor && <strong data-testid="spectator-turn" style={{ color: actor.color }}>{t("{name} の番", { name: actor.name })}</strong>}
      <label><input type="checkbox" checked={keepView} onChange={e => onKeepView(e.target.checked)} />{t("手動視点を維持")}</label>
    </div>
    {wind}
  </footer>;
};
