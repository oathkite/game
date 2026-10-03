import { useSyncExternalStore } from "react";
import { fullscreenSupported, isFullscreen, subscribeFullscreen, toggleFullscreen } from "./fullscreen";

export type Fullscreen = { readonly supported: boolean; readonly active: boolean; readonly toggle: () => void };

const subscribe = (listener: () => void): (() => void) => subscribeFullscreen(document, listener);
const unchanging = (): (() => void) => () => undefined;
const supportedNow = (): boolean => fullscreenSupported(document);
const activeNow = (): boolean => isFullscreen(document);
const outsideBrowser = (): boolean => false;
const toggle = (): void => { void toggleFullscreen(document); };

/** 全画面の状態。Esc やブラウザの操作で抜けたときも fullscreenchange で追いつく。document の無い描画（テストの静的描画）では非対応として扱う */
export const useFullscreen = (): Fullscreen => {
  const supported = useSyncExternalStore(unchanging, supportedNow, outsideBrowser);
  const active = useSyncExternalStore(subscribe, activeNow, outsideBrowser);
  return { supported, active, toggle };
};
