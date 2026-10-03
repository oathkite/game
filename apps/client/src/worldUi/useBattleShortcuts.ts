import { useEffect, useRef } from "react";
import { battleShortcut } from "./battleShortcuts";

/** 文字を打つ欄。チェックボックスやボタンにフォーカスがあるときはキーを受ける */
const TEXT_FIELDS = "textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button])";
const isEditing = (target: EventTarget | null): boolean => target instanceof HTMLElement && (target.isContentEditable || target.matches(TEXT_FIELDS));

/** 対戦画面に共通のキー（M で設定、F で全画面）を受ける。手番かどうかに関係なく効く */
export const useBattleShortcuts = (onMenu: () => void, toggleFullscreen: () => void): void => {
  const latest = useRef({ onMenu, toggleFullscreen });
  latest.current = { onMenu, toggleFullscreen };
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      const shortcut = battleShortcut({ code: e.code, repeat: e.repeat, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, editing: isEditing(e.target), dialogOpen: document.querySelector("dialog[open]") !== null });
      if (!shortcut) return;
      e.preventDefault();
      if (shortcut === "menu") latest.current.onMenu();
      else latest.current.toggleFullscreen();
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);
};
