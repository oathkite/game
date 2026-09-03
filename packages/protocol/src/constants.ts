// サーバーとクライアントが共有する語彙。設計書 08、09。

export const PLAYER_COLORS = ["red", "orange", "yellow", "cyan", "blue", "pink", "purple"] as const;

/** 設計書 08 の 8.2 の色。主色と副色の候補 */
export const COLOR_HEX: Readonly<Record<(typeof PLAYER_COLORS)[number], string>> = {
  red: "#FF4040",
  orange: "#FF9F1C",
  yellow: "#FFE14D",
  cyan: "#40D0FF",
  blue: "#4D7CFF",
  pink: "#FF66C4",
  purple: "#B070FF",
};

export const MAP_NAMES = ["valley", "mountain", "island"] as const;

export const MAP_LABELS: Readonly<Record<(typeof MAP_NAMES)[number], string>> = {
  valley: "谷",
  mountain: "山越え",
  island: "浮島",
};

export const NICKNAME_MAX = 12;
export const ROOM_TITLE_MAX = 24;
export const ROOM_CODE_LENGTH = 6;
/** 読み違えやすい O、0、I、1 を除いた文字 */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const LOBBY_PAGE_SIZE = 20;
export const MAX_PLAYERS = 2;
export const MAX_SPECTATORS = 8;
export const TURN_LIMIT = 20;
export const TURN_SECONDS = 20;
