import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/i18n/locale";
import { announceTurn, showsNotice } from "./turnNotice";
import "./yourTurn.css";

/** Announce once per turn, including consecutive turns by the same player. */
export const YourTurn = ({ turnKey, active }: { readonly turnKey: string; readonly active: boolean }) => {
  const { t } = useLanguage();
  const seen = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const next = announceTurn(seen.current, turnKey, active);
    if (next === seen.current) return;
    seen.current = next;
    setNotice(next);
  }, [active, turnKey]);
  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), 1800);
    return () => clearTimeout(timer);
  }, [notice]);
  return showsNotice(notice, turnKey) ? createPortal(
    <div className="your-turn" role="status" aria-live="polite" key={turnKey}>
      {t("あなたのターン")}
    </div>, document.body,
  ) : null;
};
