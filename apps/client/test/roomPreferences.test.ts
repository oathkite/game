import { afterEach, expect, it, vi } from "vitest";
import { readRoomPreferences, saveRoomPreferences } from "../src/worldUi/roomPreferences";
afterEach(() => vi.unstubAllGlobals());
it("restores settings while excluding passwords from storage", () => {
  let stored = "null";
  vi.stubGlobal("localStorage", { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } });
  const settings = { name: "Room", mapId: "random", turnLimit: 0, password: "secret" };
  saveRoomPreferences(settings);
  expect(JSON.parse(stored)).toEqual({ name: "Room", mapId: "random", turnLimit: 0 });
  expect(readRoomPreferences()).toEqual({ name: "Room", mapId: "random", turnLimit: 0 });
});
it("falls back for unavailable storage, invalid JSON and obsolete options", () => {
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
  const defaults = readRoomPreferences();
  expect(() => saveRoomPreferences(defaults)).not.toThrow();
  vi.stubGlobal("localStorage", { getItem: () => "broken" });
  expect(readRoomPreferences()).toEqual(defaults);
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ mapId: "removed", turnLimit: 99 }) });
  expect(readRoomPreferences()).toEqual(defaults);
});
