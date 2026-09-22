// 設計書 01、02、06 の初期値。長さの単位はセル、固定小数点は小数部 16 bit。

/** 固定小数点の 1.0 */
export const ONE = 65536;

export { MAP_HEIGHT, MAP_WIDTH } from "@game/protocol";

export const TANK_RADIUS = 3;
export const TANK_RADIUS_SQ = TANK_RADIUS * TANK_RADIUS;
export const BLAST_RADIUS = 10;

export const HP_MAX = 100;
export const DAMAGE_MAX = 35;
export const DAMAGE_PER_CELL = 3;

export const ELEVATION_MIN = 10;
export const ELEVATION_MAX = 90;
export const POWER_MAX = 100;
export const WIND_MAX = 10;

/** 主砲の付け根は接地点から車体基準で真上にこの長さ */
export const BARREL_BASE_UP = 4;
export const BARREL_LENGTH = 4;

/** 1 ステップあたりの重力加速（固定小数点）。約 0.04 セル/step^2 */
export const GRAVITY = 2621;
/** 風 1 につき 1 ステップあたりの横加速（固定小数点）。約 0.0003 セル/step^2 */
export const WIND_ACCEL_PER_UNIT = 20;
/** パワー 100 のときの初速（固定小数点）。3.5 セル/step */
export const MAX_SPEED = 229376;
export const MAX_STEPS = 4000;

export const STEPS_PER_TURN = 30;
/** 1歩で乗り越えられる段差は4セルまで。それを超える上りは壁、下りは落下。 */
export const CLIMB_MAX = 4;
/**
 * 上り坂の急さを測る幅（列）と、その幅で登れる高さの上限（セル）。
 * 14 列で 13 セルより高く上る上り（おおむね 43 度より急）は、1 歩の段差が CLIMB_MAX 以内でも壁になる。
 * 主砲のクレーター（半径 10）は深さ 10 セルなので、緩い坂の途中にできても 3 セルの余裕で縁を登って出られる。
 */
export const SLOPE_RUN = 14;
export const SLOPE_RISE_MAX = 13;
/** 傾きを測る幅。中心から左右にこのセル数 */
export const TILT_HALF_WIDTH = 3;
export const TILT_DIFF_MAX = 6;

export const WIND_DELTA_MAX = 2;
export const GUST_PERCENT = 15;
