import { COLOR_HEX, PLAYER_COLORS, type PlayerColor } from "@game/protocol";

// 設計書 40.4 の固定パレット。地形、機体、弾、爆発、背景、UI の画素はすべてこの表の色で塗る。
// チームの色（COLOR_HEX）の値は変えず、各色に光、基準、影、深い影の 4 段を固定の表で持つ。
// 影は紺へ、光は暖かい白へ寄せる。

export const PALETTE = {
  sky0: 0x070a12, sky1: 0x0b1122, sky2: 0x111a33, sky3: 0x1a2646, sky4: 0x25345c,
  white: 0xffffff, starDim: 0xb8c6f0, starFaint: 0x6878a8, moon: 0xf2eed2, moonShade: 0xb8b294,
  greenPale: 0xd9f5e1, greenLight: 0x80ff9f, green: 0x33ff66, greenMid: 0x1fb04a, greenDark: 0x127a33, greenDeep: 0x0f4d24, greenBlack: 0x082b15,
  loam0: 0x7a5436, loam1: 0x573b27, loam2: 0x3b281c, loam3: 0x251913,
  stone0: 0x9aa0ad, stone1: 0x6c7280, stone2: 0x4a4f5c, stone3: 0x30343f,
  ochre0: 0xb07a3c, ochre1: 0x85592a, ochre2: 0x5c3c1c,
  violet0: 0x6a5a86, violet1: 0x4a3f60, violet2: 0x2f2840,
  outline: 0x050608,
  fire1: 0xfff1a6, fire2: 0xffd23f, fire3: 0xff9f1c, fire4: 0xff5a1f, fire5: 0xc42d1c, fire6: 0x5e1712,
  smoke0: 0xc4cac7, smoke1: 0x8b9290, smoke2: 0x545b59, smoke3: 0x2c3130,
  metal0: 0xd5dcdf, metal1: 0x979fa4, metal2: 0x5f666b, metal3: 0x373d41,
  energy0: 0xe6fbff, energy1: 0x7fe3ff, energy2: 0x40d0ff,
  black: 0x000000,
} as const;

/** 熱い順。白、淡い黄、黄、橙、赤橙、赤、暗い赤 */
export const FIRE_RAMP: readonly number[] = [PALETTE.white, PALETTE.fire1, PALETTE.fire2, PALETTE.fire3, PALETTE.fire4, PALETTE.fire5, PALETTE.fire6];
/** 明るい順 */
export const SMOKE_RAMP: readonly number[] = [PALETTE.smoke0, PALETTE.smoke1, PALETTE.smoke2, PALETTE.smoke3];

export type Ramp = { readonly light: number; readonly base: number; readonly shadow: number; readonly deep: number };

const ramp = (light: number, base: number, shadow: number, deep: number): Ramp => ({ light, base, shadow, deep });

export const TEAM_RAMPS: Readonly<Record<PlayerColor, Ramp>> = {
  red: ramp(0xff948b, 0xff4040, 0x932f3c, 0x4b171d),
  orange: ramp(0xffc877, 0xff9f1c, 0x936329, 0x4b3213),
  yellow: ramp(0xffed92, 0xffe14d, 0x938744, 0x4b4420),
  cyan: ramp(0x96e3f4, 0x40d0ff, 0x2a7ea5, 0x163f52),
  blue: ramp(0x9db5f4, 0x4d7cff, 0x3250a5, 0x192852),
  pink: ramp(0xffa9d3, 0xff66c4, 0x934485, 0x4b2242),
  purple: ramp(0xd4aff4, 0xb070ff, 0x6849a5, 0x352452),
  green: ramp(0x8ffda0, 0x33ff66, 0x239851, 0x124c27),
  mint: ramp(0xb9fddc, 0x80ffd4, 0x4e988e, 0x274c46),
  white: ramp(0xf7f7f4, 0xf0f4ff, 0x8b92a5, 0x474952),
};

/** protocol の色の文字列（#RRGGBB）から段を引く。チームの色でなければ null */
export const rampOf = (hex: string): Ramp | null => {
  const value = Number.parseInt(hex.slice(1), 16);
  const found = PLAYER_COLORS.find(color => Number.parseInt(COLOR_HEX[color].slice(1), 16) === value);
  return found ? TEAM_RAMPS[found] : null;
};

const ALLOWED: ReadonlySet<number> = new Set([
  ...Object.values(PALETTE),
  ...Object.values(TEAM_RAMPS).flatMap(r => [r.light, r.base, r.shadow, r.deep]),
]);

/** CSS と canvas 2D に渡す色の文字列（#rrggbb） */
export const cssHex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/** 固定パレットの色か。テストで、描いた画素がすべてパレットの色であることを確かめる */
export const isPaletteColor = (color: number): boolean => ALLOWED.has(color);
