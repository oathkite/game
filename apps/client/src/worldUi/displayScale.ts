const KEY = "keropod.displayScale";
export const loadDisplayScale = (): number => {
  try { return localStorage.getItem(KEY) === "12" ? 12 : 9; } catch { return 9; }
};
export const saveDisplayScale = (value: number): void => {
  try { localStorage.setItem(KEY, value === 9 ? "9" : "12"); } catch { /* Storage may be disabled. */ }
};

// 通常のカメラは 8 px/セル。1 art px（1/4 セル）が 2 CSS px の整数になる（設計書 40.3）。
// 開発用の「等倍」は 12 px/セルで、1 art px が 3 CSS px になる。
export const loadCameraScale = (): number => (loadDisplayScale() === 12 ? 12 : 8);
