import { describe, expect, it } from "vitest";
import { FRAME_SKINS, TURRET_SKINS, WEAPON_IDS } from "@game/protocol";
import { ELEVATION_MAX, ELEVATION_MIN, muzzleOf, ONE, slopedMask, tiltOf, type TerrainMask } from "@game/sim";
import { isPaletteColor, PALETTE, TEAM_RAMPS } from "@/game/palette";
import { bigWheel, stoneWheel } from "@/game/frameDraw";
import { createGrid, getPixel, TRANSPARENT, type PixelGrid } from "@/game/pixelGrid";
import { chargeSparks, flashFrameAt, FLASH_FRAME_MS } from "@/game/tankFlash";
import { MATERIAL } from "@/game/tankShape";
import { barrelGeometry, barrelMask, composeTank, muzzleTip, TANK_FRAME, type TankSpriteInput } from "@/game/tankSprite";

// 機体のスプライト。設計書 40.5、43 と 10.5「全仰角で発射点と絵の砲口が一致する」

const base: TankSpriteInput = {
  hull: TEAM_RAMPS.red, turret: TEAM_RAMPS.yellow, turretSkin: "dome", frame: "tracks", weapon: "cannon", sub: "digger",
  facing: 1, tilt: 0, elevation: 45, recoil: 0, sink: 0, treadPhase: 0, white: false, wrecked: false, rim: "none", flash: null, sparks: [],
};

const opaquePixels = (grid: PixelGrid): { x: number; y: number; color: number }[] => {
  const out: { x: number; y: number; color: number }[] = [];
  for (let y = grid.top; y < grid.top + grid.height; y++) for (let x = grid.left; x < grid.left + grid.width; x++) {
    const color = getPixel(grid, x, y);
    if (color !== TRANSPARENT) out.push({ x, y, color });
  }
  return out;
};

/**
 * 描いた砲身の先端（砲身の向きに最後の 1.5 px、軸から 1.5 px 以内）にある画素の中心の重心と、いちばん先の画素の位置（砲身の向きの距離）。
 * 3 本の管やミサイルの箱のように先端が幅広い砲身でも、弾が出る中央の管で比べる
 */
const renderedTip = (input: TankSpriteInput) => {
  const { pivot, angle, length } = barrelGeometry(input);
  const rad = (angle * Math.PI) / 180, dir = { x: Math.cos(rad), y: -Math.sin(rad) }, normal = { x: input.facing * Math.sin(rad), y: input.facing * Math.cos(rad) };
  const tip = opaquePixels(barrelMask(input)).map(p => {
    const cx = p.x + 0.5, cy = p.y + 0.5;
    return { x: cx, y: cy, u: (cx - pivot.x) * dir.x + (cy - pivot.y) * dir.y, v: (cx - pivot.x) * normal.x + (cy - pivot.y) * normal.y };
  }).filter(p => p.u >= length - 1.5 && Math.abs(p.v) < 1.5);
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
  it.each(WEAPON_IDS)("%s の砲身は、全仰角、全傾き、両向きで、描いた砲口の先端が物理の砲口から 1.25 art px 以内にある", weapon => {
    for (const { mask, tilt } of cases) for (const facing of [1, -1] as const) for (let elevation = ELEVATION_MIN; elevation <= ELEVATION_MAX; elevation++) {
      const muzzle = muzzleOf(mask, { x: 100, y: 150 }, facing, elevation);
      const expected = { x: (muzzle.position.x / ONE - 100.5) * 4, y: (muzzle.position.y / ONE - 150) * 4 };
      const input = { ...base, weapon, facing, tilt, elevation };
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
  it("どの砲塔、フレーム、武器の組でも、固定パレットの色で描き、±45 度に傾けても枠の端で切れない", () => {
    for (const frame of FRAME_SKINS) for (const turretSkin of TURRET_SKINS) for (const tilt of [-45, 0, 45]) for (const wrecked of [false, true]) {
      const weapon = WEAPON_IDS[(TURRET_SKINS.indexOf(turretSkin) + tilt) & 7]!, sub = WEAPON_IDS[(TURRET_SKINS.indexOf(turretSkin) + 3) & 7]!;
      const grid = composeTank({ ...base, frame, turretSkin, weapon, sub, tilt, elevation: 90, wrecked, rim: "charge", treadPhase: 5 });
      const pixels = opaquePixels(grid);
      for (const p of pixels) expect(isPaletteColor(p.color), `${frame} ${turretSkin} 0x${p.color.toString(16)}`).toBe(true);
      // 枠の外周の行と列に画素が無い。あれば絵が枠で切れている
      const edge = pixels.filter(p => p.x === TANK_FRAME.left || p.y === TANK_FRAME.top || p.x === TANK_FRAME.left + TANK_FRAME.width - 1 || p.y === TANK_FRAME.top + TANK_FRAME.height - 1);
      expect(edge, `${frame} ${turretSkin} tilt ${tilt}`).toEqual([]);
    }
  });
  it("フレームは主色の車体を持ち、砲塔は副色で塗る", () => {
    for (const frame of FRAME_SKINS) for (const turretSkin of TURRET_SKINS) {
      const colors = new Set(opaquePixels(composeTank({ ...base, frame, turretSkin })).map(p => p.color));
      expect(colors.has(TEAM_RAMPS.red.base), `${frame}`).toBe(true);
      expect(colors.has(TEAM_RAMPS.yellow.base), `${turretSkin}`).toBe(true);
    }
  });
  it("浮遊は地面から浮いて見えるよう噴射の下に隙間を空け、待機中に車体を上下させない", () => {
    const at = (beat: number) => composeTank({ ...base, frame: "hover", beat, sub: null });
    // 噴射の真下の 2 行は空き、地面の行に波紋の光がある
    for (const beat of [0, 4]) for (const y of [-3, -2]) for (let x = -2; x < 2; x++) expect(getPixel(at(beat), x, y), `beat ${beat} (${x}, ${y})`).toBe(TRANSPARENT);
    expect(opaquePixels(at(0)).some(p => p.y === -1 && p.color === PALETTE.energy1)).toBe(true);
    // 時刻のコマで変わるのは噴射と波紋だけで、車体の輪郭の高さは変わらない
    const hullBottom = (grid: PixelGrid) => Math.max(...opaquePixels(grid).filter(p => p.x === -12 && p.color === PALETTE.outline).map(p => p.y));
    for (const beat of [1, 2, 3, 4, 5, 6, 7]) expect(hullBottom(at(beat)), `beat ${beat}`).toBe(hullBottom(at(0)));
    expect(Array.from(at(1).pixels).join()).not.toBe(Array.from(at(0).pixels).join());
    // 残骸は噴射が止まり、地面に落ちる（いちばん下の輪郭が接地点の行）
    const wreck = opaquePixels(composeTank({ ...base, frame: "hover", wrecked: true }));
    expect(Math.max(...wreck.map(p => p.y))).toBe(0);
    expect(wreck.some(p => p.color === PALETTE.energy1)).toBe(false);
  });
  it("車輪と石の車輪は、進むと上の縁が前へ動く向き（右向きで時計回り）に回る", () => {
    const wheel = (draw: typeof bigWheel, phase: number) => {
      const grid = createGrid(-10, -10, 20, 20);
      draw(grid, 0, 0, 7, phase, false);
      return grid;
    };
    // タイヤの溝は上の縁で前（右）へ流れる。1 px 進んだ並びは、前の並びを右へ 1 px ずらしたものに近い
    const rim = (phase: number) => Array.from({ length: 12 }, (_, i) => getPixel(wheel(bigWheel, phase), i - 6, -7));
    const matches = (a: readonly number[], b: readonly number[]) => a.filter((v, i) => v === b[i]).length;
    const before = rim(0), after = rim(1);
    expect(matches(after.slice(1), before.slice(0, -1))).toBeGreaterThan(matches(after.slice(0, -1), before.slice(1)));
    // 石の車輪のひびは、軸の右で下へ回る
    const crackY = (phase: number) => {
      const ys: number[] = [];
      for (let y = -4; y <= 4; y++) for (let x = 3; x <= 5; x++) if (getPixel(wheel(stoneWheel, phase), x, y) === MATERIAL.stoneDeep) ys.push(y);
      return ys.reduce((sum, y) => sum + y, 0) / ys.length;
    };
    expect(crackY(4)).toBeGreaterThan(crackY(1));
  });
  it("サブ武器は車体後部に載り、null なら載せない。残骸には載せない", () => {
    const rear = (input: TankSpriteInput) => opaquePixels(composeTank(input)).filter(p => p.x <= -10 && p.y <= -14 && p.y >= -22).length;
    expect(rear({ ...base, turretSkin: "wedge", sub: "laser" })).toBeGreaterThan(rear({ ...base, turretSkin: "wedge", sub: null }));
    const wreck = composeTank({ ...base, wrecked: true, sub: "laser" });
    expect(opaquePixels(wreck).some(p => p.color === PALETTE.energy1)).toBe(false);
  });
  it("キャタピラとドームは、輪郭で囲んだ接地点の上の機体を描く", () => {
    const pixels = opaquePixels(composeTank({ ...base, elevation: 10, sub: null }));
    // 履帯と車体（砲塔より下）は x −15〜15（前の泥よけまで）、輪郭を含めて −16〜16。いちばん下の輪郭が接地点の行 0
    const body = pixels.filter(p => p.y >= -13);
    const xs = body.map(p => p.x), ys = body.map(p => p.y);
    expect(Math.min(...xs)).toBe(-16);
    expect(Math.max(...xs)).toBe(16);
    expect(Math.max(...ys)).toBe(0);
    // ハッチの上の輪郭が −24
    expect(Math.min(...pixels.filter(p => p.x >= -3 && p.x <= 0).map(p => p.y))).toBe(-24);
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
