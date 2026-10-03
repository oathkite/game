import { afterEach, expect, it, vi } from "vitest";
import { loadProfile, saveProfile } from "../src/app/profile";

// 端末に保存するプレイヤー設定。設計書 09 の 9.2 と 43（機体のスキン）

afterEach(() => vi.unstubAllGlobals());

const storage = (initial: unknown) => {
  let stored = JSON.stringify(initial);
  vi.stubGlobal("localStorage", { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } });
  return { read: () => JSON.parse(stored) as unknown };
};

it("スキンを足す前に保存した設定は、色を保ったまま既定のスキン（ドーム、キャタピラ）で読む", () => {
  storage({ playerId: "player-0001", nickname: "A", colors: { primary: "blue", secondary: "pink" } });
  expect(loadProfile().colors).toEqual({ primary: "blue", secondary: "pink", turret: "dome", frame: "tracks" });
});

it("選んだスキンを保存し、読み直しても同じスキンになる", () => {
  const store = storage(null);
  const profile = loadProfile();
  saveProfile({ ...profile, colors: { ...profile.colors, turret: "onion", frame: "walker" } });
  expect(store.read()).toMatchObject({ colors: { turret: "onion", frame: "walker" } });
  expect(loadProfile().colors).toMatchObject({ turret: "onion", frame: "walker" });
});

it("知らないスキンは既定のスキンに戻す", () => {
  storage({ playerId: "player-0001", colors: { primary: "red", secondary: "yellow", turret: "removed", frame: 3 } });
  expect(loadProfile().colors).toMatchObject({ turret: "dome", frame: "tracks" });
});
