import { Graphics, type Container } from "pixi.js";
import { PALETTE } from "../palette";
import { createGradeFilter } from "./gradeFilter";
import { composeTables, DIM_TABLE, type GradeTable } from "./gradeTables";

// 画面全体にかかる演出。設計書 41.6 の I5 と、41.13 の評価と改善。
// 暗転は、爆心の周りを残すスポットライトにし、外の地形と背景の色を 1 段暗いパレットの色へ置き換える。
// 空の色は、武器と大ダメージで置き換え表を当てる。どちらも置き換え表のフィルター（gradeFilter.ts）で、描く画素はパレットの色のまま。
// 強さを Bayer の市松で段に分けて戻すと空が網のように見えたので、長さの間は表をそのまま当て、終わったら外す。
// 戦車、火球、粒、数字には当てない（暗転の手前に見える）。全画面の光は 1 コマの白。

/** スポットライトの縁の市松の幅（セル） */
const DIM_EDGE_CELLS = 3;
/** 背景の 1 art px の画面の px（pixelBackdrop の PX と同じ） */
const BACKDROP_PX = 2;

export type ScreenFx = {
  /** stage の最前に置く全画面の光 */
  readonly flash: Graphics;
  /** from から ms の間、爆心（セル）の周り半径 radius（セル）を残して暗くする */
  readonly dimAt: (cx: number, cy: number, radius: number, from: number, ms: number) => void;
  /** at から ms の間、画面全体を白くする */
  readonly flashAt: (at: number, ms: number) => void;
  /** from から ms の間、空の色を表で置き換える */
  readonly tintAt: (table: GradeTable, from: number, ms: number) => void;
  readonly tick: (now: number, screen: { readonly width: number; readonly height: number }) => void;
  readonly clear: () => void;
  readonly destroy: () => void;
};

type View = {
  /** 地形（セルで描く world の中）と背景（画面に固定） */
  readonly terrain: Container;
  readonly sky: Container;
  /** セルの座標を画面の px にする。スポットライトの中心に使う */
  readonly toScreen: (cx: number, cy: number) => { readonly x: number; readonly y: number };
  /** 1 セルの画面の px */
  readonly cell: () => number;
};

export const createScreenFx = (view: View): ScreenFx => {
  const terrainGrade = createGradeFilter(), skyGrade = createGradeFilter();
  const flash = new Graphics();
  flash.visible = false;
  let spot = { cx: 0, cy: 0, radius: 0, from: Infinity, until: -Infinity };
  let flashFrom = Infinity, flashUntil = -Infinity, tint: { table: GradeTable; from: number; ms: number } | null = null;
  let terrainKey = "", skyKey = "";
  const place = (target: Container, grade: typeof terrainGrade, key: string, table: GradeTable | null, strength: number, px: number, withSpot: boolean): string => {
    if (!table) { if (target.filters) target.filters = null; return ""; }
    if (key !== (target === view.terrain ? terrainKey : skyKey)) grade.setTable(table);
    const c = view.toScreen(spot.cx + 0.5, spot.cy + 0.5), cell = view.cell();
    grade.setSpot(c.x, c.y, withSpot ? spot.radius * cell : 0, DIM_EDGE_CELLS * cell);
    grade.setStrength(strength);
    grade.setPixel(px);
    if (!target.filters) target.filters = [grade.filter];
    return key;
  };
  return {
    flash,
    dimAt: (cx, cy, radius, from, ms) => { spot = { cx, cy, radius, from, until: from + ms }; },
    flashAt: (at, ms) => { flashFrom = at; flashUntil = at + ms; },
    tintAt: (table, from, ms) => { tint = { table, from, ms }; },
    tick: (now, screen) => {
      const dimming = now >= spot.from && now < spot.until;
      const tinting = tint !== null && now >= tint.from && now < tint.from + tint.ms ? tint : null;
      terrainKey = place(view.terrain, terrainGrade, dimming ? "dim" : "", dimming ? DIM_TABLE : null, 1, view.cell() / 4, true);
      // 空は、暗転と色の寄せが重なったら続けて当てる。スポットライトは地形だけにする（空に残すと、寄せた空に元の色の円が浮いた）
      const skyTable = dimming && tinting ? composeTables(DIM_TABLE, tinting.table) : dimming ? DIM_TABLE : tinting?.table ?? null;
      const key = `${dimming}/${tinting ? tinting.from : ""}`;
      skyKey = place(view.sky, skyGrade, key, skyTable, 1, BACKDROP_PX, false);
      const flashing = now >= flashFrom && now < flashUntil;
      if (flashing && !flash.visible) flash.clear().rect(0, 0, screen.width, screen.height).fill(PALETTE.white);
      flash.visible = flashing;
    },
    clear: () => {
      spot = { cx: 0, cy: 0, radius: 0, from: Infinity, until: -Infinity };
      flashFrom = Infinity; flashUntil = -Infinity; tint = null;
      view.terrain.filters = null; view.sky.filters = null; terrainKey = ""; skyKey = "";
      flash.visible = false;
    },
    destroy: () => { terrainGrade.destroy(); skyGrade.destroy(); },
  };
};
