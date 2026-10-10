// 設計書 01、02、06 の初期値。長さの単位はセル、固定小数点は小数部 16 bit。

/** 固定小数点の 1.0 */
export const ONE = 65536;

export { MAP_HEIGHT, MAP_WIDTH } from "@game/protocol";

/** 機体の体の半径。立つ位置、天井との空き、傾き、テレポートの着地を決める */
export const TANK_RADIUS = 3;
export const TANK_RADIUS_SQ = TANK_RADIUS * TANK_RADIUS;
/**
 * 機体の芯の半径。弾は芯にだけ当たり、ダメージの着弾距離も芯から測る。
 * 芯を外れた弾は車体を素通りして足元の地面に当たり、削る。
 * 1 にするのは、真上から足元（中心から 2 列）に落としたレーザー弾の段（半径 3、約 4 セル間隔）が機体の列を途切れなく掘り抜けるようにするためである。
 */
export const CORE_RADIUS = 1;
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
 * 上りの急さを測る前方の幅（列）。車体の長さと同じ。
 * 移動先から前方この列数の地表が、同じセル数より高い（45 度より急な）上りには、1 歩の段差が CLIMB_MAX 以内でも進めない。
 * 見えている前方の地面だけで決め、どこから歩いてきたかや、うしろの崖には左右されない。
 */
export const CLIMB_AHEAD = 6;
/** 傾きを測る幅。中心から左右にこのセル数 */
export const TILT_HALF_WIDTH = 3;
export const TILT_DIFF_MAX = 6;

export const WIND_DELTA_MAX = 2;
export const GUST_PERCENT = 15;
