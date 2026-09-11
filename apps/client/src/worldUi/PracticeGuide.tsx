import { useState } from "react";
import { useLanguage } from "@/i18n/locale";
import { useTouchControls } from "./useTouchControls";
import "./practiceGuide.css";

const key = "keropod.practice-guide-seen";
let seen = false;
export const dismissPracticeGuide = (): void => {
  seen = true;
  try { localStorage.setItem(key, "1"); } catch { /* Keep the choice for this visit. */ }
};
const initiallyOpen = (): boolean => {
  try { return !seen && localStorage.getItem(key) !== "1"; } catch { return !seen; }
};
export const PracticeGuide = () => {
  const { t } = useLanguage();
  const touch = useTouchControls();
  const [open, setOpen] = useState(initiallyOpen);
  return <details className="practice-guide" open={open} onToggle={event => {
    const next = event.currentTarget.open;
    setOpen(next);
    if (!next) dismissPracticeGuide();
  }}>
    <summary>{t("操作のヒント")}</summary>
    <ol>
      <li><strong>{t("風を読む")}</strong><span>{t("流れる葉が風向きと強さの目印。")}</span></li>
      <li><strong>{t("角度を合わせる")}</strong><span>{t(touch ? "＋／−で照準を調整。円形メーターで地面と砲身の角度を確認。" : "W／S・↑／↓で照準を調整。円形メーターで地面と砲身の角度を確認。")}</span></li>
      <li><strong>{t("溜めて、離す")}</strong><span>{t(touch ? "発射ボタンを長押し。狙ったパワーで離す。" : "Spaceを長押し。狙ったパワーで離す。")}</span></li>
    </ol>
  </details>;
};
