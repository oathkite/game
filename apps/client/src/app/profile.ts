import { PLAYER_COLORS, type PlayerColor, type TankColors } from "@game/protocol";

// 端末に保存するプレイヤー設定。設計書 09 の 9.2。

export type Profile = {
  readonly playerId: string;
  readonly nickname: string;
  readonly colors: TankColors;
  readonly volume: number;
  readonly muted: boolean;
  readonly swapPanels: boolean;
};

const KEY = "fortress.profile.v1";

const randomId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const isColor = (v: unknown): v is PlayerColor => typeof v === "string" && (PLAYER_COLORS as readonly string[]).includes(v);

const defaults = (): Profile => ({
  playerId: randomId(),
  nickname: "",
  colors: { primary: "red", secondary: "yellow" },
  volume: 0.5,
  muted: false,
  swapPanels: false,
});

const read = (): unknown => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
};

export const loadProfile = (): Profile => {
  const base = defaults();
  const raw = read();
  if (typeof raw !== "object" || raw === null) {
    saveProfile(base);
    return base;
  }
  const r = raw as Record<string, unknown>;
  const colors = typeof r.colors === "object" && r.colors !== null ? (r.colors as Record<string, unknown>) : {};
  const profile: Profile = {
    playerId: typeof r.playerId === "string" && r.playerId.length >= 8 ? r.playerId : base.playerId,
    nickname: typeof r.nickname === "string" ? r.nickname.slice(0, 12) : base.nickname,
    colors: {
      primary: isColor(colors.primary) ? colors.primary : base.colors.primary,
      secondary: isColor(colors.secondary) ? colors.secondary : base.colors.secondary,
    },
    volume: typeof r.volume === "number" ? Math.min(1, Math.max(0, r.volume)) : base.volume,
    muted: typeof r.muted === "boolean" ? r.muted : base.muted,
    swapPanels: typeof r.swapPanels === "boolean" ? r.swapPanels : base.swapPanels,
  };
  return profile;
};

export const saveProfile = (profile: Profile): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // 保存できない環境では保持だけする
  }
};
