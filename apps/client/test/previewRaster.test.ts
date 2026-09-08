import { COLOR_HEX, type TankColors } from "@game/protocol";
import { describe, expect, it } from "vitest";
import { CARVE_AT_MS, HOLD_MS } from "@/game/hitFeedback";
import { bulletCells, rasterize, rgbOf, terrainOf } from "@/screens/previewRaster";
import { demoFrame, demoShots, fieldFor, prepareDemo, type DemoFrame } from "@/screens/weaponDemo";

// プレビューのラスター。対戦画面と同じく 1 セル 1 ピクセルで、地形は sim の carve、爆風はセルの円で描かれることを固定する。

const FIELD = fieldFor(160);
const COLORS: TankColors = { primary: "red", secondary: "yellow" };
const EMPTY: DemoFrame = { bullets: [], blasts: [], craters: [], debris: [], done: true };

const pixel = (r: ReturnType<typeof rasterize>, x: number, y: number): readonly number[] => {
  const o = (y * r.width + x) * 4;
  return [...r.data.slice(o, o + 4)];
};

describe("rgbOf", () => {
  it("#RRGGBB を分ける", () => {
    expect(rgbOf("#FF4040")).toEqual([255, 64, 64]);
  });
});

describe("terrainOf", () => {
  it("地面の行から下だけが埋まり、削れた穴は sim の円で抜ける", () => {
    const solid = terrainOf(FIELD, EMPTY);
    expect(solid.cells[(FIELD.ground - 1) * FIELD.cols + 10]).toBe(0);
    expect(solid.cells[FIELD.ground * FIELD.cols + 10]).toBe(1);
    const carved = terrainOf(FIELD, { ...EMPTY, craters: [{ x: 50.7, y: FIELD.ground, radius: 3 }] });
    expect(carved.cells[FIELD.ground * FIELD.cols + 50]).toBe(0);
    expect(carved.cells[(FIELD.ground + 3) * FIELD.cols + 50]).toBe(0);
    expect(carved.cells[(FIELD.ground + 4) * FIELD.cols + 50]).toBe(1);
    expect(carved.cells[(FIELD.ground + 3) * FIELD.cols + 53]).toBe(1);
  });
});

describe("bulletCells", () => {
  it("小さな弾でも中心のセルを塗り、大きな弾は矩形のセルを塗る", () => {
    expect(bulletCells({ x: 10.3, y: 5.6, w: 0.4, h: 0.4 })).toEqual([{ x: 10, y: 5 }]);
    expect(bulletCells({ x: 10.5, y: 5.5, w: 3, h: 1 })).toEqual([
      { x: 9, y: 5 },
      { x: 10, y: 5 },
      { x: 11, y: 5 },
    ]);
  });

  it("向きのある長い弾は、中心から前後へ向きに沿った線分のセルを塗る", () => {
    const flat = bulletCells({ x: 10.5, y: 5.5, w: 8, h: 0.5, angle: 0 });
    expect(flat.every((c) => c.y === 5)).toBe(true);
    expect(flat.map((c) => c.x)).toEqual([7, 8, 9, 10, 11, 12, 13, 14]);
    // 右上へ 45 度（y は下向きが正）。x が増えるほど y が減る対角線
    const diagonal = bulletCells({ x: 10.5, y: 10.5, w: 8, h: 0.5, angle: -Math.PI / 4 });
    // 格子に丸めるので x + y は 20 か 21 の帯に収まる
    expect(diagonal.every((c) => c.x + c.y === 20 || c.x + c.y === 21)).toBe(true);
    expect(diagonal[0]?.x ?? 0).toBeLessThan(diagonal[diagonal.length - 1]?.x ?? 0);
    expect(diagonal.length).toBeGreaterThanOrEqual(5);
    // 向きがあっても短い弾は矩形のまま
    expect(bulletCells({ x: 10.5, y: 5.5, w: 1, h: 1, angle: -Math.PI / 4 })).toEqual([{ x: 10, y: 5 }]);
  });
});

describe("rasterize", () => {
  it("大きさは切れ端のセル数で、地面は白、戦車は主色と副色、空は透明", () => {
    const r = rasterize(FIELD, EMPTY, COLORS);
    expect([r.width, r.height]).toEqual([FIELD.cols, FIELD.rows]);
    expect(pixel(r, 30, FIELD.ground)).toEqual([255, 255, 255, 255]);
    expect(pixel(r, 30, 2)).toEqual([0, 0, 0, 0]);
    expect(pixel(r, FIELD.tank.x + 3, FIELD.tank.y + 4)).toEqual([...rgbOf(COLOR_HEX.red), 255]);
    expect(pixel(r, FIELD.tank.x + 3, FIELD.tank.y)).toEqual([...rgbOf(COLOR_HEX.yellow), 255]);
  });

  it("着弾後は爆風のセルが主色になり、削れた後の穴は透明になる", () => {
    const demo = prepareDemo("cannon", FIELD);
    const stage = demoShots("cannon", FIELD)[0]?.stages[0];
    if (!stage) throw new Error("stage");
    const cx = Math.floor(stage.x);
    const expanding = rasterize(FIELD, demoFrame(demo, stage.at + (HOLD_MS + 119) / 1000), COLORS);
    expect(pixel(expanding, cx, Math.floor(stage.y))).toEqual([...rgbOf(COLOR_HEX.red), 255]);
    const carved = rasterize(FIELD, demoFrame(demo, stage.at + 2), COLORS);
    expect(pixel(carved, cx, FIELD.ground + 5)).toEqual([0, 0, 0, 0]);
    expect(pixel(carved, cx, FIELD.ground + 11)).toEqual([255, 255, 255, 255]);
    expect(CARVE_AT_MS).toBeLessThan(2000);
  });
});
