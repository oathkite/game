import { LanguageSelect } from "@/i18n/LanguageSelect";
import { useLanguage } from "@/i18n/locale";
import { PixelButton } from "./PixelUi";

export const StartScreen = ({ onBegin }: { readonly onBegin: () => void }) => {
  const { t } = useLanguage();
  return <section className="world-start">
    <div className="world-language"><LanguageSelect /></div>
    <h1><span className="world-title-text">TANK SHOOT</span></h1>
    <PixelButton onClick={onBegin}>{t("はじめる")}</PixelButton>
  </section>;
};
