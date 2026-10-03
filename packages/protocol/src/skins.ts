// 機体のスキン。設計書 43。色と同じく、プレイヤーが出撃準備で選ぶ見た目だけの値で、当たり判定と砲口の位置は変えない。
// 砲塔の形と、車体と足回りを一体にしたフレームの 2 つを選ぶ。ここには語彙だけを置き、絵は client に置く。

export const TURRET_SKINS = ["dome", "wide", "box", "wedge", "fin", "pot", "onion", "flat"] as const;
export type TurretSkin = (typeof TURRET_SKINS)[number];

export const FRAME_SKINS = ["tracks", "bigTracks", "wheels", "walker", "hover", "stoneWheels", "reverseJoint", "ball"] as const;
export type FrameSkin = (typeof FRAME_SKINS)[number];

export const TURRET_LABELS: Readonly<Record<TurretSkin, string>> = {
  dome: "ドーム", wide: "ワイド", box: "ボックス", wedge: "ウェッジ", fin: "フィン", pot: "ポット", onion: "オニオン", flat: "フラット",
};

export const FRAME_LABELS: Readonly<Record<FrameSkin, string>> = {
  tracks: "キャタピラ", bigTracks: "大型キャタピラ", wheels: "車輪", walker: "多脚", hover: "浮遊", stoneWheels: "石車輪", reverseJoint: "逆関節", ball: "大玉",
};

export const DEFAULT_TURRET: TurretSkin = "dome";
export const DEFAULT_FRAME: FrameSkin = "tracks";

export const isTurretSkin = (v: unknown): v is TurretSkin => typeof v === "string" && (TURRET_SKINS as readonly string[]).includes(v);
export const isFrameSkin = (v: unknown): v is FrameSkin => typeof v === "string" && (FRAME_SKINS as readonly string[]).includes(v);

/** 描くスキン。欠けた値（スキンを足す前の保存状態）と、後から足されて知らないスキンは既定のスキンにする（設計書 43.9） */
export const turretSkinOf = (v: unknown): TurretSkin => (isTurretSkin(v) ? v : DEFAULT_TURRET);
export const frameSkinOf = (v: unknown): FrameSkin => (isFrameSkin(v) ? v : DEFAULT_FRAME);
