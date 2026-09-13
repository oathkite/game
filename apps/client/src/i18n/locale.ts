import { useSyncExternalStore } from "react";
import { english } from "./messages";
export type Language = "ja" | "en";
const key = "keropod.language";
export const resolveLanguage = (saved: string | null, browser: string | readonly string[]): Language => {
  if (saved === "ja" || saved === "en") return saved;
  for (const tag of typeof browser === "string" ? [browser] : browser) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "ja" || base === "en") return base;
  }
  return "en";
};
const initial = (): Language => {
  if (typeof window === "undefined") return "ja";
  const browser = navigator.languages.length ? navigator.languages : [navigator.language];
  try { return resolveLanguage(localStorage.getItem(key), browser); } catch { return resolveLanguage(null, browser); }
};
let language = initial();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const setLanguage = (next: Language): void => {
  language = next;
  try { localStorage.setItem(key, next); } catch { /* The current session can still change language. */ }
  document.documentElement.lang = next;
  listeners.forEach(listener => listener());
};
export const translate = (text: string, locale: Language, values: Readonly<Record<string, string | number>> = {}): string =>
  (locale === "en" ? english[text] ?? text : text).replace(/\{(\w+)\}/g, (match, key: string) => values[key] === undefined ? match : String(values[key]));
export const useLanguage = () => {
  const locale = useSyncExternalStore(subscribe, () => language, () => "ja" as Language);
  return { language: locale, t: (text: string, values?: Readonly<Record<string, string | number>>) => translate(text, locale, values) };
};
