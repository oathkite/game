const KEY = "keropod.displayScale";
export const loadDisplayScale = (): number => {
  try { return localStorage.getItem(KEY) === "12" ? 12 : 9; } catch { return 9; }
};
export const saveDisplayScale = (value: number): void => {
  try { localStorage.setItem(KEY, value === 9 ? "9" : "12"); } catch { /* Storage may be disabled. */ }
};

// 機体サイズのデバッグ設定とは別に、通常のカメラを少し引く。
export const loadCameraScale = (): number => loadDisplayScale() * 7 / 9;
