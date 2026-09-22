import { STAGES } from "./stages";
export type Progress = Readonly<Record<string, number>>;
export const PROGRESS_KEY = "fortress.practice.v1";

export const parseProgress = (raw: string | null): Progress => {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(STAGES.flatMap((s) => {
      const best: unknown = (value as Record<string, unknown>)[s.id];
      return typeof best === "number" && Number.isInteger(best) && best > 0 && best <= s.shots ? [[s.id, best]] : [];
    }));
  } catch { return {}; }
};
export const loadProgress = (): Progress => {
  try { return parseProgress(localStorage.getItem(PROGRESS_KEY)); } catch { return {}; }
};
export const saveProgress = (progress: Progress): boolean => {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); return true; } catch { return false; }
};
export const recordClear = (progress: Progress, id: string, shots: number): Progress => ({ ...progress, [id]: Math.min(progress[id] ?? shots, shots) });
export const nextStageIndex = (progress: Progress): number => {
  const index = STAGES.findIndex((s) => progress[s.id] === undefined);
  return index < 0 ? 0 : index;
};
