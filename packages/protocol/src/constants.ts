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

/** 設計書 02 の 2.9 の 8 枚。順序はロビーの選択肢の順 */
export const MAP_NAMES = ["valley", "mountain", "island", "plain", "terrace", "bridge", "cave", "towers"] as const;

export const MAP_LABELS: Readonly<Record<(typeof MAP_NAMES)[number], string>> = {
  valley: "谷",
  mountain: "山越え",
  island: "浮島",
  plain: "平原",
  terrace: "段丘",
  bridge: "橋",
  cave: "洞窟",
  towers: "双塔",
};

/** 部屋の設定で「開始時に 8 枚から抽選する」を表す値。対戦そのものは常に具体的なマップを持つ */
export const RANDOM_MAP = "random" as const;

/** 部屋で選べる値。マップ名とランダム */
export const MAP_CHOICES = [RANDOM_MAP, ...MAP_NAMES] as const;

export const MAP_CHOICE_LABELS: Readonly<Record<(typeof MAP_CHOICES)[number], string>> = {
  [RANDOM_MAP]: "ランダム",
  ...MAP_LABELS,
};

/** マップの大きさ（セル）。sim もこの値を使う */
export const MAP_WIDTH = 400;
export const MAP_HEIGHT = 225;

/** 1 フレームの上限（バイト）。最大のメッセージでも 1 KiB に収まる */
export const MAX_MESSAGE_BYTES = 4096;

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
