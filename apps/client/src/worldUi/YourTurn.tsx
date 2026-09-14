import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/i18n/locale";
import "./yourTurn.css";

/** Announce once per turn, including consecutive turns by the same player. */
export const YourTurn = ({ turnKey, active }: { readonly turnKey: string; readonly active: boolean }) => {
  const { t } = useLanguage();
  const seen = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!active || seen.current === turnKey) return;
    seen.current = turnKey;
    setNotice(turnKey);
  }, [active, turnKey]);
  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), 1800);
    return () => clearTimeout(timer);
  }, [notice]);
  return active && notice === turnKey ? createPortal(
    <div className="your-turn" role="status" aria-live="polite" key={turnKey}>
      {t("あなたのターン")}
    </div>, document.body,
  ) : null;
};
