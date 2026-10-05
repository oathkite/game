import { DEFAULT_FRAME, DEFAULT_LOADOUT, DEFAULT_TURRET, isFrameSkin, isTurretSkin, parseLoadout, PLAYER_COLORS, type Loadout, type PlayerColor, type TankColors } from "@game/protocol";

// 端末に保存するプレイヤー設定。設計書 09 の 9.2。

export type Profile = {
  readonly playerId: string;
  readonly nickname: string;
  /** 機体の色（カラー 1 が砲塔と砲身、カラー 2 が車体）とスキン（砲塔、フレーム）。設計書 43 */
  readonly colors: TankColors;
  /** 装備する 2 つの武器。設計書 10 */
  readonly loadout: Loadout;
  readonly volume: number;
  readonly bgmVolume?: number;
  readonly muted: boolean;
  readonly swapPanels: boolean;
};

export const PROFILE_KEY = "fortress.profile.v1";

const randomId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const isColor = (v: unknown): v is PlayerColor => typeof v === "string" && (PLAYER_COLORS as readonly string[]).includes(v);

const defaults = (): Profile => ({
  playerId: randomId(),
  nickname: "",
  colors: { primary: "red", secondary: "yellow", turret: DEFAULT_TURRET, frame: DEFAULT_FRAME },
  loadout: DEFAULT_LOADOUT,
  volume: 0.5,
  bgmVolume: 0.5,
  muted: false,
  swapPanels: false,
});

const read = (): unknown => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
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
      // スキンを足す前に保存した設定には無いので、既定のスキンにする
      turret: isTurretSkin(colors.turret) ? colors.turret : DEFAULT_TURRET,
      frame: isFrameSkin(colors.frame) ? colors.frame : DEFAULT_FRAME,
    },
    loadout: parseLoadout(r.loadout) ?? DEFAULT_LOADOUT,
    volume: typeof r.volume === "number" ? Math.min(1, Math.max(0, r.volume)) : base.volume,
    bgmVolume: typeof r.bgmVolume === "number" ? Math.min(1, Math.max(0, r.bgmVolume)) : typeof r.volume === "number" ? Math.min(1, Math.max(0, r.volume)) : 0.5,
    muted: typeof r.muted === "boolean" ? r.muted : base.muted,
    swapPanels: typeof r.swapPanels === "boolean" ? r.swapPanels : base.swapPanels,
  };
  return profile;
};

export const saveProfile = (profile: Profile): void => {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // 保存できない環境では保持だけする
  }
};
