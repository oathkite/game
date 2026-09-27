import { describe, expect, it, vi } from "vitest";
import { createFxLayer } from "@/game/fx/fxLayer";
import { createRendererEffects, FLASH_MS } from "@/game/fx/rendererEffects";
import { createScreenFx } from "@/game/fx/screenFx";
import { HITSTOP_MS, HP_DRAIN_MS } from "@/game/hitFeedback";
import { PALETTE } from "@/game/palette";

// 撃破の全画面の光（設計書 41.6 の I5）。始まりは描画の時計で決め、長さはコマの経過で数えて、ヒットストップで延ばさない

// フィルターは canvas と WebGL が要るので、何もしないものに替える
vi.mock("@/game/fx/gradeFilter", () => ({
  createGradeFilter: () => ({ filter: {}, setTable: () => {}, setStrength: () => {}, setSpot: () => {}, setPixel: () => {}, destroy: () => {} }),
}));

const SCREEN = { width: 100, height: 100 };
const createTestScreenFx = () => createScreenFx({ terrain: { filters: null }, sky: { filters: null }, toScreen: () => ({ x: 0, y: 0 }), cell: () => 8 } as unknown as Parameters<typeof createScreenFx>[0]);

/** 描画の時計の並びを 1 コマ 16 ms ずつ送り、白を出したコマの時計を返す。reserve なら先に 400 から FLASH_MS の白を予約する */
const shownAt = (clocks: readonly number[], reserve = true): readonly number[] => {
  const screenFx = createTestScreenFx();
  if (reserve) screenFx.flashAt(400, FLASH_MS);
  return clocks.filter((now) => { screenFx.tick(now, SCREEN, 16); return screenFx.flash.visible; });
};

describe("全画面の光の長さ", () => {
  it("描画の時計が止まらなければ、from から ms の間のコマで出す", () => {
    const clocks = Array.from({ length: 10 }, (_, i) => 368 + i * 16);
    expect(shownAt(clocks)).toEqual([400, 416, 432]);
  });
  it("出し始めた後に描画の時計が止まっても、コマの経過が ms に達したら消す", () => {
    // レーザー弾の最後の段のヒットストップ。描画の時計は 432 で 60 ms 止まり、436 から進む
    expect(shownAt([384, 400, 416, 432, 432, 432, 432, 436, 452])).toEqual([400, 416, 432]);
  });
  it("始まる前に描画の時計が止まったら、止めた分だけ遅れて始まる", () => {
    expect(shownAt([388, 388, 388, 392, 408, 424, 440])).toEqual([408, 424]);
  });
  it("初めのコマが from を過ぎていたら、過ぎた分も数え、コマの経過がちょうど ms になったコマでは出さない", () => {
    // 2 + 16 + 16 = 34 ms
    expect(shownAt([398, 402, 418, 434])).toEqual([402, 418]);
  });
  it("予約がなければ出さない", () => {
    expect(shownAt([384, 400, 416], false)).toEqual([]);
  });
  it("1 コマで終わりまで過ぎたら出さない", () => {
    expect(shownAt([300, 500, 516])).toEqual([]);
  });
  it("予約した白も、出している白も、clear の後は出さない", () => {
    // FX ラボで撃ち直すと、前の射撃で予約した白を消す
    const reserved = createTestScreenFx();
    reserved.flashAt(400, FLASH_MS);
    reserved.tick(384, SCREEN, 16);
    reserved.clear();
    reserved.tick(400, SCREEN, 16);
    expect(reserved.flash.visible).toBe(false);
    const shown = createTestScreenFx();
    shown.flashAt(400, FLASH_MS);
    shown.tick(400, SCREEN, 16);
    expect(shown.flash.visible).toBe(true);
    shown.clear();
    expect(shown.flash.visible).toBe(false);
    shown.tick(416, SCREEN, 16);
    expect(shown.flash.visible).toBe(false);
  });
});

describe("撃破の白とヒットストップ", () => {
  // renderer.ts と同じ順で 1 コマずつ進める。描画の時計を進めてから、画面全体の演出を描く
  const rig = () => {
    const fx = createFxLayer(), screenFx = createTestScreenFx();
    const effects = createRendererEffects({ fx, screenFx, texels: undefined, screen: () => SCREEN, reduced: () => false, soil: [PALETTE.loam1] });
    const bounds = { left: 0, top: 0, right: 100, bottom: 100 };
    /** 削る瞬間から ms まで 16 ms ずつ進め、白を出したコマの時刻を返す。after にある時刻のコマでは、描いた後にその関数を呼ぶ */
    const whiteFrames = (ms: number, after: ReadonlyMap<number, () => void> = new Map()): readonly number[] => {
      const white: number[] = [];
      for (let m = 16; m <= ms; m += 16) {
        fx.tick(16, bounds);
        effects.tick(16);
        if (screenFx.flash.visible) white.push(m);
        after.get(m)?.();
      }
      return white;
    };
    return { effects, whiteFrames };
  };
  it("レーザー弾の 1 段目で撃破し、最後の段のヒットストップが白と重なっても、白は 34 ms で消える", () => {
    // 7 段目の削る瞬間は、1 段目の削る瞬間から 432 ms 後（FX ラボで測った時刻）。描画の時計で数えると 400〜480 の 6 コマ出た
    const r = rig();
    r.effects.killFlash(HP_DRAIN_MS);
    expect(r.whiteFrames(640, new Map([[432, () => r.effects.freeze(HITSTOP_MS)]]))).toEqual([400, 416, 432]);
  });
  it("最後の着弾で撃破すると、白はヒットストップの分だけ遅れて始まり、34 ms で消える", () => {
    // 標準砲。削る瞬間に白を予約し、同じ瞬間にヒットストップが始まる
    const r = rig();
    r.effects.killFlash(HP_DRAIN_MS);
    r.effects.freeze(HITSTOP_MS);
    expect(r.whiteFrames(640)).toEqual([464, 480]);
  });
});
