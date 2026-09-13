import { DotIcon } from "./DotIcon";
import type { ButtonHTMLAttributes } from "react";
import { useLanguage } from "@/i18n/locale";

type Action = "left" | "right" | "up" | "down" | "fire";
export const BattleTouchControls = ({ disabled, button, steps = false }: {
  readonly disabled: boolean;
  readonly button: (action: Action) => ButtonHTMLAttributes<HTMLButtonElement>;
  readonly steps?: boolean;
}) => {
  const { t } = useLanguage();
  return <><div className="battle-dpad">
    <button className="dpad-up" aria-label={t("角度を上げる")} disabled={disabled} {...button("up")}><DotIcon name="up" /></button>
    <button className="dpad-left" aria-label={t(steps ? "左へ1歩" : "左へ移動")} disabled={disabled} {...button("left")}><DotIcon name="left" /></button>
    <i aria-hidden="true" />
    <button className="dpad-right" aria-label={t(steps ? "右へ1歩" : "右へ移動")} disabled={disabled} {...button("right")}><DotIcon name="right" /></button>
    <button className="dpad-down" aria-label={t("角度を下げる")} disabled={disabled} {...button("down")}><DotIcon name="down" /></button>
  </div><button className="battle-touch-fire" aria-label={t("発射")} disabled={disabled} {...button("fire")}>{t("発射")}</button></>;
};
