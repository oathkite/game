import type { Loadout, MainWeaponId, SubWeaponId, WeaponId } from "@game/protocol";
import { BARREL_LENGTH } from "@game/sim";

// 武器の見た目。設計書 10 の 10.5 と 08 の 8.6。単位はセルで、対戦画面（PixiJS）と設定画面（SVG）が同じ形を使う。
// メインウェポンは主砲の形、サブウェポンは砲塔の上に載せる部品の形を変える。当たり判定と発射位置には影響しない。

export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

/**
 * 主砲。付け根を原点、砲の伸びる向きを +x とした矩形の列。長さは物理の主砲（4 セル）に揃え、太さと先端で武器を見分ける。
 * 太さは 1 セルを基準に、重砲は太く、長砲は細くする。
 */
export const barrelRects = (main: MainWeaponId): readonly Rect[] => {
  switch (main) {
    case "cannon":
      return [{ x: 0, y: -0.5, w: BARREL_LENGTH, h: 1 }];
    case "heavy":
      // 太い砲身と、先端の一段太い砲口
      return [
        { x: 0, y: -0.75, w: BARREL_LENGTH - 1, h: 1.5 },
        { x: BARREL_LENGTH - 1, y: -1, w: 1, h: 2 },
      ];
    case "sniper":
      // 細い砲身と、中ほどの照準の突起
      return [
        { x: 0, y: -0.35, w: BARREL_LENGTH, h: 0.7 },
        { x: 1.5, y: -1, w: 1, h: 0.65 },
      ];
  }
};

/**
 * サブウェポンの部品。車体の接地点を原点、上を -y とした矩形の列で、砲塔（y = -5 から -3）の上に載せる。
 * 車体は左右対称なので、部品も左右対称にして向きの手がかりを主砲だけに残す。
 */
export const podRects = (sub: SubWeaponId): readonly Rect[] => {
  switch (sub) {
    case "digger":
      // 砲塔の上に伏せた幅広の弾倉
      return [{ x: -2, y: -6, w: 4, h: 1 }];
    case "floater":
      // 両肩の丸い浮き袋（1 セルの正方形を 2 つ）
      return [
        { x: -3, y: -6, w: 1, h: 1 },
        { x: 2, y: -6, w: 1, h: 1 },
      ];
    case "stinger":
      // 中央に立つ細い針
      return [{ x: -0.25, y: -7, w: 0.5, h: 2 }];
  }
};

/** 弾の見た目の大きさ（セル）。重い弾ほど大きく、針弾は小さい。物理の弾は常に 1 セル */
export const bulletSize = (weapon: WeaponId): { readonly w: number; readonly h: number } => {
  switch (weapon) {
    case "heavy":
      return { w: 1.6, h: 1.6 };
    case "digger":
      return { w: 1.4, h: 1.4 };
    case "sniper":
      return { w: 1.4, h: 0.6 };
    case "stinger":
      return { w: 1, h: 0.4 };
    case "floater":
      return { w: 1.2, h: 1.2 };
    case "cannon":
      return { w: 1, h: 1 };
  }
};

export const loadoutRects = (loadout: Loadout): { readonly barrel: readonly Rect[]; readonly pod: readonly Rect[] } => ({
  barrel: barrelRects(loadout.main),
  pod: podRects(loadout.sub),
});
