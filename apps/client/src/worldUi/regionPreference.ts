import type { RoomRegion } from "@game/protocol/v2-rooms";
export const regionPreferenceKey = "game.room-region";
export const validRegion = (value: unknown): value is RoomRegion =>
  value === "asia" || value === "europe" || value === "americas";
export const regionFromTimezone = (timezone: string): RoomRegion => {
  if (timezone.startsWith("America/") || timezone === "Pacific/Honolulu") return "americas";
  if (timezone.startsWith("Europe/") || timezone.startsWith("Africa/") || timezone.startsWith("Atlantic/")) return "europe";
  return "asia";
};
export const savedRegion = (): RoomRegion | null => {
  try { const value = localStorage.getItem(regionPreferenceKey); return validRegion(value) ? value : null; }
  catch { return null; }
};
