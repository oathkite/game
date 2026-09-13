import { setLanguage, useLanguage, type Language } from "./locale";
export const LanguageSelect = () => {
  const { language } = useLanguage();
  return <select aria-label="Language / 言語" value={language} onChange={e => setLanguage(e.target.value as Language)}>
    <option value="ja">日本語</option><option value="en">English</option>
  </select>;
};
