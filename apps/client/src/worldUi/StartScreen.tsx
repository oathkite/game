import { LanguageSelect } from "@/i18n/LanguageSelect";
import { useLanguage } from "@/i18n/locale";
import { PixelButton } from "./PixelUi";
import { TitleLogo } from "./TitleLogo";
import { TitleScene } from "./TitleScene";

// タイトル画面。対戦と同じ夜空と地形の絵の上に、ドット文字の題名を置く（設計書 40.10）
export const StartScreen = ({ onBegin }: { readonly onBegin: () => void }) => {
  const { t } = useLanguage();
  return <section className="world-start">
    <TitleScene />
    <div className="world-language"><LanguageSelect /></div>
    <h1><TitleLogo text="TANK SHOOT" /></h1>
    <PixelButton onClick={onBegin}>{t("はじめる")}</PixelButton>
  </section>;
};
