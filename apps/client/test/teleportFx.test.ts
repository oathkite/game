import { describe, expect, it } from "vitest";
import { PALETTE } from "@/game/palette";
import { ARRIVE_BEAM, DEPART_BEAM, teleportBeam, teleportBurst, teleportMotes, teleportRing, teleportShock, teleportStreak } from "@/game/fx/teleportFx";

// テレポートの光の柱と粒（設計書 42.3）。位置はセル、粒は art px（1/4 セル）

const at = (b: ReturnType<typeof teleportBeam>, i: number) => ({ x: b.x0[i]!, y: b.y0[i]!, t0: b.t0[i]!, life: b.life[i]! });
const all = (b: ReturnType<typeof teleportBeam>) => Array.from({ length: b.count }, (_, i) => at(b, i));

describe("teleportBeam", () => {
  const beam = teleportBeam(100, 150, ARRIVE_BEAM), dots = all(beam);
  const bottom = (150 + 0.5) * 4, center = (100 + 0.5) * 4;
  it("着地点の真上に、地面から空へ伸びる細い柱を描く", () => {
    expect(beam.count).toBeGreaterThan(500);
    expect(beam.count).toBeLessThan(6000);
    for (const d of dots) {
      expect(Math.abs(d.x + 0.5 - center)).toBeLessThan(ARRIVE_BEAM.flareWidth!);
      expect(d.y).toBeLessThan(bottom);
      expect(d.y).toBeGreaterThanOrEqual(bottom - ARRIVE_BEAM.height * 4);
    }
  });
  it("空から降りてくる。上の粒ほど先に生まれ、外側の粒は後から生まれて先に消える（太ってから細る）", () => {
    const top = dots.filter(d => d.y < bottom - ARRIVE_BEAM.height * 2), low = dots.filter(d => d.y > bottom - 20);
    expect(Math.min(...top.map(d => d.t0))).toBeLessThan(Math.min(...low.map(d => d.t0)));
    const core = dots.filter(d => Math.abs(d.x + 0.5 - center) < 2 && d.y > bottom - 40), rim = dots.filter(d => Math.abs(d.x + 0.5 - center) > ARRIVE_BEAM.halfWidth * 0.7 && d.y > bottom - 40);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(rim.map(d => d.t0))).toBeGreaterThan(avg(core.map(d => d.t0)));
    expect(avg(rim.map(d => d.t0 + d.life))).toBeLessThan(avg(core.map(d => d.t0 + d.life)));
    for (const d of dots) expect(d.t0 + d.life).toBeLessThanOrEqual(ARRIVE_BEAM.descend + ARRIVE_BEAM.widen + ARRIVE_BEAM.duration);
  });
  it("芯は白く、縁は発光色。上へ行くほど薄くなる", () => {
    expect(beam.ramps.some(r => r[0] === PALETTE.white)).toBe(true);
    expect(beam.ramps.flat()).toContain(PALETTE.energy2);
    const upper = dots.filter(d => d.y < bottom - ARRIVE_BEAM.height * 3).length, lower = dots.filter(d => d.y > bottom - ARRIVE_BEAM.height).length;
    expect(upper).toBeLessThan(lower);
  });
  it("撃った位置の柱は低く細く短い", () => {
    expect(DEPART_BEAM.height).toBeLessThan(ARRIVE_BEAM.height);
    expect(teleportBeam(100, 150, DEPART_BEAM).count).toBeLessThan(beam.count);
  });
});

describe("粒", () => {
  it("光の粒は柱の中から立ちのぼる", () => {
    const b = teleportMotes(100, 150, 2, 40, ARRIVE_BEAM, 0);
    expect(b.count).toBe(40);
    for (let i = 0; i < b.count; i++) expect(b.vy[i]).toBeLessThan(0);
    expect(b.gravity).toBeLessThanOrEqual(0);
  });
  it("光の輪は地面に沿って左右へ走り、現れる瞬間に生まれる", () => {
    const b = teleportRing(100, 150, 3, 320);
    const left = Array.from(b.vx).filter(v => v < 0).length, right = Array.from(b.vx).filter(v => v > 0).length;
    expect(left).toBeGreaterThan(0); expect(right).toBeGreaterThan(0);
    for (let i = 0; i < b.count; i++) { expect(b.t0[i]).toBe(320); expect(Math.abs(b.vy[i]!)).toBeLessThan(Math.abs(b.vx[i]!)); }
  });
  it("現れる瞬間の火花は機体の中心から四方へ散る", () => {
    const b = teleportBurst(100, 150, 4, 320);
    const angles = new Set(Array.from({ length: b.count }, (_, i) => Math.round(Math.atan2(b.vy[i]!, b.vx[i]!) / (Math.PI / 2))));
    expect(angles.size).toBeGreaterThanOrEqual(3);
  });
  it("現れる瞬間に、機体の中心を横切る光の筋が出て、端から縮む", () => {
    const b = teleportStreak(100, 150, 320), center = (100 + 0.5) * 4;
    const ends = Array.from({ length: b.count }, (_, i) => ({ dx: Math.abs(b.x0[i]! - center), life: b.life[i]! }));
    expect(Math.max(...ends.map(e => e.dx))).toBeGreaterThan(30);
    const near = ends.filter(e => e.dx < 4), far = ends.filter(e => e.dx > 30);
    expect(Math.min(...near.map(e => e.life))).toBeGreaterThan(Math.max(...far.map(e => e.life)));
  });
  it("現れる瞬間の光の輪は円周に等間隔で並び、同じ速さで広がる", () => {
    const b = teleportShock(100, 150, 320);
    const speeds = new Set(Array.from({ length: b.count }, (_, i) => Math.round(Math.hypot(b.vx[i]!, b.vy[i]! / 0.6))));
    expect(speeds.size).toBe(1);
    expect(b.drag).toBeGreaterThan(0);
  });
  it("着地点の柱は、機体が現れる瞬間に一度太る", () => {
    const beam = teleportBeam(100, 150, ARRIVE_BEAM), center = (100 + 0.5) * 4;
    const wide = Array.from({ length: beam.count }, (_, i) => i).filter(i => Math.abs(beam.x0[i]! + 0.5 - center) >= ARRIVE_BEAM.halfWidth);
    expect(wide.length).toBeGreaterThan(0);
    for (const i of wide) expect(beam.t0[i]).toBe(ARRIVE_BEAM.flareAt);
  });
});
