import { describe, expect, it } from "vitest";
import { ELEVATION_MAX, ELEVATION_MIN, muzzleOf, ONE, slopedMask, tiltOf, type TerrainMask } from "@game/sim";
import { isPaletteColor, PALETTE, TEAM_RAMPS } from "@/game/palette";
import { getPixel, TRANSPARENT, type PixelGrid } from "@/game/pixelGrid";
import { chargeSparks, flashFrameAt, FLASH_FRAME_MS } from "@/game/tankFlash";
import { barrelGeometry, barrelMask, composeTank, muzzleTip, TANK_FRAME, type TankSpriteInput } from "@/game/tankSprite";

// 機体のスプライト。設計書 40.5 と 10.5「全仰角で発射点と絵の砲口が一致する」

const base: TankSpriteInput = {
  hull: TEAM_RAMPS.red, turret: TEAM_RAMPS.yellow, facing: 1, tilt: 0, elevation: 45, recoil: 0, sink: 0, treadPhase: 0,
  white: false, wrecked: false, rim: "none", flash: null, sparks: [],
};

const opaquePixels = (grid: PixelGrid): { x: number; y: number; color: number }[] => {
  const out: { x: number; y: number; color: number }[] = [];
  for (let y = grid.top; y < grid.top + grid.height; y++) for (let x = grid.left; x < grid.left + grid.width; x++) {
    const color = getPixel(grid, x, y);
    if (color !== TRANSPARENT) out.push({ x, y, color });
  }
  return out;
};

/** 描いた砲身の先端の列（砲身の向きに最後の 1.5 px）にある画素の中心の重心と、いちばん先の画素の位置（砲身の向きの距離） */
const renderedTip = (input: TankSpriteInput) => {
  const { pivot, angle, length } = barrelGeometry(input);
  const rad = (angle * Math.PI) / 180, dir = { x: Math.cos(rad), y: -Math.sin(rad) };
  const tip = opaquePixels(barrelMask(input)).map(p => {
    const cx = p.x + 0.5, cy = p.y + 0.5;
    return { x: cx, y: cy, u: (cx - pivot.x) * dir.x + (cy - pivot.y) * dir.y };
  }).filter(p => p.u >= length - 1.5);
  return { x: tip.reduce((s, p) => s + p.x, 0) / tip.length, y: tip.reduce((s, p) => s + p.y, 0) / tip.length, far: Math.max(...tip.map(p => p.u)), length };
};

describe("砲口と物理の一致", () => {
  // slopedMask の傾きごとに、物理の muzzleOf（固定小数点）を art px（接地点が原点）に直して比べる
  const cases: { mask: TerrainMask; tilt: number }[] = [];
  for (let slope = -6; slope <= 6; slope++) {
    const mask = slopedMask(slope);
    cases.push({ mask, tilt: tiltOf(mask, { x: 100, y: 150 }) });
  }
  it("傾きの表の値がすべて出ている", () => {
    expect(new Set(cases.map(c => c.tilt)).size).toBeGreaterThanOrEqual(9);
  });
  it("全仰角、全傾き、両向きで、描いた砲口の先端が物理の砲口から 1.25 art px 以内にある", () => {
    for (const { mask, tilt } of cases) for (const facing of [1, -1] as const) for (let elevation = ELEVATION_MIN; elevation <= ELEVATION_MAX; elevation++) {
      const muzzle = muzzleOf(mask, { x: 100, y: 150 }, facing, elevation);
      const expected = { x: (muzzle.position.x / ONE - 100.5) * 4, y: (muzzle.position.y / ONE - 150) * 4 };
      const input = { ...base, facing, tilt, elevation };
      const tip = renderedTip(input);
      expect(Math.hypot(tip.x - expected.x, tip.y - expected.y), `tilt ${tilt} facing ${facing} elevation ${elevation}`).toBeLessThanOrEqual(1.25);
      // 砲身の画素は砲口まで届き、越えない
      expect(tip.far).toBeGreaterThanOrEqual(tip.length - 1);
      expect(tip.far).toBeLessThan(tip.length);
      const exact = muzzleTip(input);
      expect(Math.hypot(exact.x - expected.x, exact.y - expected.y)).toBeLessThan(0.05);
    }
  });
  it("反動の分だけ砲口が付け根へ下がる", () => {
    const rest = muzzleTip(base), kicked = muzzleTip({ ...base, recoil: 2 });
    expect(Math.hypot(rest.x - kicked.x, rest.y - kicked.y)).toBeCloseTo(2, 5);
  });
});

describe("composeTank", () => {
  it("描いた画素はすべて固定パレットの色で、枠の中に収まる", () => {
    for (const color of Object.values(TEAM_RAMPS)) for (const tilt of [-45, -18, 0, 27, 45]) for (const facing of [1, -1] as const) {
      const grid = composeTank({ ...base, hull: color, turret: TEAM_RAMPS.blue, tilt, facing, elevation: 90, flash: 0, sparks: chargeSparks(1, 100, false), rim: "hot" });
      expect(grid.width).toBe(TANK_FRAME.width);
      for (const p of opaquePixels(grid)) expect(isPaletteColor(p.color), `0x${p.color.toString(16)}`).toBe(true);
    }
  });
  it("輪郭で囲み、接地点の上に横 32 px、縦 20 px の車体を描く", () => {
    const pixels = opaquePixels(composeTank({ ...base, elevation: 10 }));
    // 履帯と車体（砲塔より下）は x −15〜14、輪郭を含めて −16〜15。いちばん下の輪郭が接地点の行 0
    const body = pixels.filter(p => p.y >= -13);
    const xs = body.map(p => p.x), ys = body.map(p => p.y);
    expect(Math.min(...xs)).toBe(-16);
    expect(Math.max(...xs)).toBe(15);
    expect(Math.max(...ys)).toBe(0);
    // ハッチの上の輪郭が −21。車体の高さは 20 px
    expect(Math.min(...pixels.filter(p => p.x >= -3 && p.x <= 0).map(p => p.y))).toBe(-21);
    expect(pixels.some(p => p.color === PALETTE.outline)).toBe(true);
    expect(pixels.some(p => p.color === TEAM_RAMPS.red.base)).toBe(true);
    expect(pixels.some(p => p.color === TEAM_RAMPS.yellow.base)).toBe(true);
  });
  it("左向きは右向きを左右反転した絵になる", () => {
    const right = composeTank({ ...base, elevation: 30 }), left = composeTank({ ...base, facing: -1, elevation: 30 });
    for (const p of opaquePixels(right)) expect(getPixel(left, -1 - p.x, p.y)).toBe(p.color);
  });
  it("履帯は 1 px 進むと絵が変わり、6 px で元に戻る", () => {
    const at = (treadPhase: number) => Array.from(composeTank({ ...base, treadPhase }).pixels).join();
    expect(at(1)).not.toBe(at(0));
    expect(at(6)).toBe(at(0));
  });
  it("被弾の白は輪郭を残してすべて白にする", () => {
    for (const p of opaquePixels(composeTank({ ...base, white: true }))) expect([PALETTE.white, PALETTE.outline]).toContain(p.color);
  });
  it("残骸は灰と熾火の色で、仰角によらず垂れた砲身を描く", () => {
    const low = composeTank({ ...base, wrecked: true, elevation: 10 }), high = composeTank({ ...base, wrecked: true, elevation: 90 });
    expect(Array.from(low.pixels).join()).toBe(Array.from(high.pixels).join());
    const colors = new Set(opaquePixels(low).map(p => p.color));
    expect(colors.has(PALETTE.fire5)).toBe(true);
    expect(colors.has(TEAM_RAMPS.red.base)).toBe(false);
  });
  it("溜めの間は砲身の上の縁を明るくし、熱いときは炎の色にする", () => {
    const colors = (rim: TankSpriteInput["rim"]) => new Set(opaquePixels(composeTank({ ...base, elevation: 20, rim })).map(p => p.color));
    expect(colors("charge").has(PALETTE.greenLight)).toBe(true);
    expect(colors("hot").has(PALETTE.fire2)).toBe(true);
    expect(colors("none").has(PALETTE.greenLight)).toBe(false);
  });
});

describe("発射光と火花", () => {
  it("発射光は 35 ms ごとに 4 コマ進み、140 ms で消える。動きを減らす設定では最初のコマだけ", () => {
    expect(flashFrameAt(0, false)).toBe(0);
    expect(flashFrameAt(FLASH_FRAME_MS, false)).toBe(1);
    expect(flashFrameAt(139, false)).toBe(3);
    expect(flashFrameAt(140, false)).toBeNull();
    expect(flashFrameAt(-1, false)).toBeNull();
    expect(flashFrameAt(10, true)).toBe(0);
    expect(flashFrameAt(40, true)).toBeNull();
  });
  it("発射光のコマは砲口の先に白を置く", () => {
    const pixels = opaquePixels(composeTank({ ...base, elevation: 0 as number, flash: 0 }));
    const tip = muzzleTip({ ...base, elevation: 0 });
    expect(pixels.some(p => p.color === PALETTE.white && p.x >= Math.floor(tip.x) && p.x <= Math.floor(tip.x) + 4)).toBe(true);
  });
  it("火花の数は 38 章 C2 の 1 + ⌊パワー × 5⌋（上限 5）で、70% から炎の色になる", () => {
    expect(chargeSparks(0, 0, false)).toEqual([]);
    expect(chargeSparks(0.1, 0, false)).toHaveLength(1);
    expect(chargeSparks(0.5, 0, false)).toHaveLength(3);
    expect(chargeSparks(1, 0, false)).toHaveLength(5);
    const hot = new Set<number>([PALETTE.fire4, PALETTE.fire3, PALETTE.fire2, PALETTE.white]);
    for (const s of chargeSparks(0.8, 200, false)) expect(hot.has(s.color)).toBe(true);
  });
  it("火花は周期の中で砲口へ近づき、1/12 秒の刻みで動く。動きを減らす設定では止まる", () => {
    const distance = (t: number) => Math.hypot(chargeSparks(0.1, t, false)[0]!.u, chargeSparks(0.1, t, false)[0]!.v);
    expect(distance(0)).toBeGreaterThan(distance(250));
    expect(chargeSparks(0.1, 10, false)).toEqual(chargeSparks(0.1, 80, false));
    expect(chargeSparks(0.6, 0, true)).toEqual(chargeSparks(0.6, 5000, true));
  });
});
