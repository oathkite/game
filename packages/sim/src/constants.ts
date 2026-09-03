// 設計書 01、02、06 の初期値。長さの単位はセル、固定小数点は小数部 16 bit。

/** 固定小数点の 1.0 */
export const ONE = 65536;

export const MAP_WIDTH = 400;
export const MAP_HEIGHT = 225;

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
/** 風 1 につき 1 ステップあたりの横加速（固定小数点）。約 0.0004 セル/step^2 */
export const WIND_ACCEL_PER_UNIT = 26;
/** パワー 100 のときの初速（固定小数点）。3 セル/step */
export const MAX_SPEED = 196608;
export const MAX_STEPS = 4000;

export const STEPS_PER_TURN = 15;
/** 1 歩で登れる高さの上限（セル） */
export const CLIMB_MAX = 1;
/** 傾きを測る幅。中心から左右にこのセル数 */
export const TILT_HALF_WIDTH = 3;
export const TILT_DIFF_MAX = 6;

export const WIND_DELTA_MAX = 2;
export const GUST_PERCENT = 15;
