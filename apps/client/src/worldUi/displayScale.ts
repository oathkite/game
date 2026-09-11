const KEY = "keropod.displayScale";
export const loadDisplayScale = (): number => {
  try { return localStorage.getItem(KEY) === "9" ? 9 : 12; } catch { return 12; }
};
export const saveDisplayScale = (value: number): void => {
  try { localStorage.setItem(KEY, value === 9 ? "9" : "12"); } catch { /* Storage may be disabled. */ }
};
