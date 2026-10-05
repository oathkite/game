import { PROFILE_KEY } from "@/app/profile";
import { PROGRESS_KEY } from "./progress";

export const TUTORIAL_KEY = "fortress.tutorial.v1";
type StorageSource = () => Storage;
const browserStorage: StorageSource = () => localStorage;

/** 名前を入れたことがあれば、今までに遊んだ人とみなす。loadProfile は初回の読み込みで名前の空の既定値を保存するので、
 * プロフィールがあるだけでは初回でないと言えない */
const named = (raw: string | null): boolean => {
  try {
    const profile: unknown = JSON.parse(raw ?? "null");
    return typeof profile === "object" && profile !== null && typeof (profile as { nickname?: unknown }).nickname === "string" && (profile as { nickname: string }).nickname.trim() !== "";
  } catch { return false; }
};

/** 初めて遊ぶ人だけを「はじめる」からチュートリアルへ案内する（設計書 44.1）。
 * 済みの印、チャレンジの記録、名前を入れたプロフィールのどれかがあれば案内しない。
 * 保存できない環境では覚えられないので、毎回初めての人として扱う。 */
export const shouldOfferTutorial = (storage: StorageSource = browserStorage): boolean => {
  try {
    const saved = storage();
    return saved.getItem(TUTORIAL_KEY) === null && saved.getItem(PROGRESS_KEY) === null && !named(saved.getItem(PROFILE_KEY));
  } catch { return true; }
};

/** チュートリアルに入った時点で済みにする。途中で抜けても次から強制しない。 */
export const markTutorialSeen = (storage: StorageSource = browserStorage): boolean => {
  try { storage().setItem(TUTORIAL_KEY, "1"); return true; } catch { return false; }
};
