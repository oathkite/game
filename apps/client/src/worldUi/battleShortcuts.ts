// 対戦画面に共通のキー（設計書 3.3、30 章）。M で設定を開き、F で全画面を出入りする。
// 全画面の中では Esc をブラウザが全画面を抜けるのに使い、ページに届かない。M は全画面の中でも設定を開ける。

export type BattleShortcut = "menu" | "fullscreen";

export type ShortcutKey = {
  readonly code: string;
  readonly repeat: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  /** 文字の入力欄にフォーカスがある */
  readonly editing: boolean;
  /** 設定、退出の確認などのダイアログが開いている */
  readonly dialogOpen: boolean;
};

export const battleShortcut = (key: ShortcutKey): BattleShortcut | null => {
  // 押し続けで全画面が点滅しないよう、オートリピートは捨てる。修飾キー付きはブラウザと OS に任せる
  if (key.repeat || key.ctrlKey || key.metaKey || key.altKey || key.editing) return null;
  if (key.code === "KeyF") return "fullscreen";
  // 設定は他のダイアログの上に重ねて開かない
  if (key.code === "KeyM" && !key.dialogOpen) return "menu";
  return null;
};
