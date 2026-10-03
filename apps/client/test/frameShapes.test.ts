import { describe, expect, it } from "vitest";
import { FRAME_SKINS, type FrameSkin } from "@game/protocol";
import { EXHAUST_PORTS } from "@/game/frameSkins";
import { PALETTE, TEAM_RAMPS } from "@/game/palette";
import { getPixel, TRANSPARENT, type PixelGrid } from "@/game/pixelGrid";
import { reverseLegPoses } from "@/game/reverseJointFrame";
import { EXHAUST_VISIBLE_MS, exhaustAt } from "@/game/tankMotion";
import { composeTank, type TankSpriteInput } from "@/game/tankSprite";

// 足回りの形と釣り合い。設計書 43.6

const base: TankSpriteInput = {
  hull: TEAM_RAMPS.red, turret: TEAM_RAMPS.yellow, turretSkin: "dome", frame: "tracks", weapon: "cannon", sub: "digger",
  facing: 1, tilt: 0, elevation: 35, recoil: 0, sink: 0, treadPhase: 0, white: false, wrecked: false, rim: "none", flash: null, sparks: [], beat: 0,
};
const PHASES = Array.from({ length: 24 }, (_, i) => i);

const opaque = (grid: PixelGrid): { x: number; y: number; color: number }[] => {
  const out: { x: number; y: number; color: number }[] = [];
  for (let y = grid.top; y < grid.top + grid.height; y++) for (let x = grid.left; x < grid.left + grid.width; x++) {
    const color = getPixel(grid, x, y);
    if (color !== TRANSPARENT) out.push({ x, y, color });
  }
  return out;
};

/** 重心（不透明な画素の横位置の平均）から、接地（y = −1 の行）の真ん中を引いた値 */
const lean = (frame: FrameSkin, phase: number): number => {
  const pixels = opaque(composeTank({ ...base, frame, treadPhase: phase, beat: phase }));
  const cg = pixels.reduce((sum, p) => sum + p.x + 0.5, 0) / pixels.length;
  const ground = pixels.filter(p => p.y === -1).map(p => p.x);
  return cg - (Math.min(...ground) + Math.max(...ground) + 1) / 2;
};

describe("足回りの釣り合い（設計書 43.6）", () => {
  it("どの足回りも、接地の真ん中が重心の真下にある（進んだ距離 0〜23 の平均で ±1.5 art px 以内）", () => {
    for (const frame of FRAME_SKINS) {
      const mean = PHASES.reduce((sum, phase) => sum + lean(frame, phase), 0) / PHASES.length;
      expect(Math.abs(mean), frame).toBeLessThanOrEqual(1.5);
    }
  });
});

describe("逆関節（設計書 43.6）", () => {
  it("どのコマでも膝が腰と足首より後ろへ折れる", () => {
    for (const phase of PHASES) for (const leg of reverseLegPoses(phase, 0, false)) {
      expect(leg.knee.x, `phase ${phase}`).toBeLessThan(leg.hip.x);
      expect(leg.knee.x, `phase ${phase}`).toBeLessThan(leg.ankle.x);
      // 膝は腰より下、足首より上（くの字）
      expect(leg.knee.y, `phase ${phase}`).toBeGreaterThan(leg.hip.y);
      expect(leg.knee.y, `phase ${phase}`).toBeLessThan(leg.ankle.y);
    }
  });
  it("接地中の足首は地面に留まり、機体が進んだぶん後ろへ流れる（滑らない）", () => {
    let grounded = 0;
    for (const phase of PHASES) {
      const now = reverseLegPoses(phase, 0, false), next = reverseLegPoses(phase + 1, 0, false);
      now.forEach((leg, i) => {
        const after = next[i]!;
        if (leg.ankle.y !== -3 || after.ankle.y !== -3 || after.ankle.x > leg.ankle.x) return;
        grounded++;
        expect(leg.ankle.x - after.ankle.x, `phase ${phase} leg ${i}`).toBeCloseTo(1, 5);
      });
    }
    // 接地 60% の 2 本足なので、24 コマ × 2 本のうち半分ほどは接地して流れる
    expect(grounded).toBeGreaterThanOrEqual(20);
  });
  it("2 本の脚を半周期ずらし、どのコマでも少なくとも 1 本は接地している", () => {
    for (const phase of PHASES) {
      expect(reverseLegPoses(phase, 0, false).some(leg => leg.ankle.y === -3), `phase ${phase}`).toBe(true);
    }
  });
});

describe("大玉（設計書 43.6）", () => {
  it("進むと球の面が回り、泥よけと軸の蓋は止まっている", () => {
    const at = (phase: number) => composeTank({ ...base, frame: "ball", treadPhase: phase, sub: null });
    const sphere = (grid: PixelGrid) => opaque(grid).filter(p => p.y >= -4 && p.y <= -1).map(p => `${p.x},${p.y},${p.color}`).join();
    expect(sphere(at(3))).not.toBe(sphere(at(0)));
    // 軸の蓋（球の中心の上）は回らない
    for (const [x, y] of [[0, -8], [-1, -9], [0, -10]] as const) expect(getPixel(at(3), x, y), `(${x}, ${y})`).toBe(getPixel(at(0), x, y));
  });
});

describe("残骸（設計書 43.6）", () => {
  it("熾火は車体の上に置き、宙に浮かない", () => {
    for (const frame of FRAME_SKINS) {
      const grid = composeTank({ ...base, frame, wrecked: true, sub: null });
      const embers = opaque(grid).filter(p => p.color === PALETTE.fire5);
      for (const e of embers) {
        const touching = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
          const c = getPixel(grid, e.x + dx!, e.y + dy!);
          return c !== TRANSPARENT && c !== PALETTE.outline && c !== PALETTE.fire5;
        });
        expect(touching.length, `${frame} (${e.x}, ${e.y})`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("排気口（設計書 43.6）", () => {
  it("逆関節は荷台の後ろの排気管から、大玉は後ろのバンパーから煙を出す。どちらも車体の画素に接している", () => {
    expect(EXHAUST_PORTS.reverseJoint).toEqual({ x: -17, y: -13 });
    expect(EXHAUST_PORTS.ball).toEqual({ x: -16, y: -9 });
    for (const frame of ["reverseJoint", "ball"] as const) {
      const port = EXHAUST_PORTS[frame]!;
      const grid = composeTank({ ...base, frame, sub: null });
      const touching = [[0, 1], [1, 0], [-1, 0], [0, 0]].some(([dx, dy]) => {
        const c = getPixel(grid, port.x + dx!, port.y + dy!);
        return c !== TRANSPARENT && c !== PALETTE.outline;
      });
      expect(touching, frame).toBe(true);
    }
  });
  it("逆関節と大玉の煙は、上がって後ろへ流れてもサブ武器（輪郭を含めて x ≥ −16、y ≤ −13）に重ならない", () => {
    for (const frame of ["reverseJoint", "ball"] as const) for (let t = 0; t < EXHAUST_VISIBLE_MS; t += 30) {
      const puff = exhaustAt(t, false, EXHAUST_PORTS[frame]!)!;
      // 粒は (x, y) から右と下へ size 画素
      const overlaps = puff.x + puff.size - 1 >= -16 && puff.y <= -13;
      expect(overlaps, `${frame} ${t} ms (${puff.x}, ${puff.y})`).toBe(false);
    }
  });
});
