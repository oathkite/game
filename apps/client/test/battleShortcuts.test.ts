import { expect, it } from "vitest";
import { battleShortcut, type ShortcutKey } from "../src/worldUi/battleShortcuts";

// 対戦画面の共通のキー（設計書 3.3、30 章）。M で設定を開き、F で全画面を切り替える。
const key = (code: string, overrides: Partial<ShortcutKey> = {}): ShortcutKey => ({ code, repeat: false, ctrlKey: false, metaKey: false, altKey: false, editing: false, dialogOpen: false, ...overrides });

it("maps M to the menu and F to fullscreen", () => {
  expect(battleShortcut(key("KeyM"))).toBe("menu");
  expect(battleShortcut(key("KeyF"))).toBe("fullscreen");
});

it("ignores keys used by the battle controls and unrelated keys", () => {
  for (const code of ["Space", "KeyA", "KeyD", "KeyW", "KeyS", "KeyQ", "KeyE", "KeyC", "Tab", "Escape", "ArrowUp", ""]) expect(battleShortcut(key(code))).toBeNull();
});

it("ignores auto-repeat so holding the key does not flicker fullscreen", () => {
  expect(battleShortcut(key("KeyF", { repeat: true }))).toBeNull();
  expect(battleShortcut(key("KeyM", { repeat: true }))).toBeNull();
});

it("leaves browser and OS shortcuts with modifiers alone", () => {
  for (const modifier of ["ctrlKey", "metaKey", "altKey"] as const) {
    expect(battleShortcut(key("KeyF", { [modifier]: true }))).toBeNull();
    expect(battleShortcut(key("KeyM", { [modifier]: true }))).toBeNull();
  }
});

it("does not steal letters while typing in a field", () => {
  expect(battleShortcut(key("KeyF", { editing: true }))).toBeNull();
  expect(battleShortcut(key("KeyM", { editing: true }))).toBeNull();
});

it("does not open the menu over another dialog, but still toggles fullscreen", () => {
  expect(battleShortcut(key("KeyM", { dialogOpen: true }))).toBeNull();
  expect(battleShortcut(key("KeyF", { dialogOpen: true }))).toBe("fullscreen");
});
