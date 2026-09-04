import { describe, expect, it } from "vitest";
import { SWIPE_DEADZONE_PX, SWIPE_ELEVATION_PX, SWIPE_STEP_PX, swipeAdvance, swipeDelta } from "@/ui/swipeAim";

// マップをなぞる操作。横は移動、縦は仰角。斜めは大きい方だけを見る。

describe("swipeDelta", () => {
  it("指のぶれは動かさない", () => {
    expect(swipeDelta(0, 0)).toEqual({ steps: 0, elevation: 0 });
    expect(swipeDelta(SWIPE_DEADZONE_PX - 1, SWIPE_DEADZONE_PX - 1)).toEqual({ steps: 0, elevation: 0 });
  });

  it("横になぞると歩数になり、右が正になる", () => {
    expect(swipeDelta(SWIPE_STEP_PX, 0)).toEqual({ steps: 1, elevation: 0 });
    expect(swipeDelta(SWIPE_STEP_PX * 3, 0)).toEqual({ steps: 3, elevation: 0 });
    expect(swipeDelta(-SWIPE_STEP_PX * 2, 0)).toEqual({ steps: -2, elevation: 0 });
  });

  it("上へなぞると仰角が上がる", () => {
    expect(swipeDelta(0, -SWIPE_ELEVATION_PX * 5)).toEqual({ steps: 0, elevation: 5 });
    expect(swipeDelta(0, SWIPE_ELEVATION_PX * 4)).toEqual({ steps: 0, elevation: -4 });
  });

  it("斜めになぞったら大きい方だけを見る", () => {
    // 横が大きい
    expect(swipeDelta(SWIPE_STEP_PX * 2, SWIPE_ELEVATION_PX)).toEqual({ steps: 2, elevation: 0 });
    // 縦が大きい
    expect(swipeDelta(SWIPE_STEP_PX / 2, -SWIPE_ELEVATION_PX * 10)).toEqual({ steps: 0, elevation: 10 });
  });

  it("1 歩に満たない移動は切り捨てる", () => {
    expect(swipeDelta(SWIPE_STEP_PX - 1, 0)).toEqual({ steps: 0, elevation: 0 });
  });
});

describe("swipeAdvance", () => {
  it("既に送った量との差だけを返す", () => {
    expect(swipeAdvance({ steps: 2, elevation: 0 }, { steps: 5, elevation: 0 })).toEqual({ steps: 3, elevation: 0 });
    expect(swipeAdvance({ steps: 0, elevation: 3 }, { steps: 0, elevation: 1 })).toEqual({ steps: 0, elevation: -2 });
  });

  it("同じ位置なら何も送らない", () => {
    expect(swipeAdvance({ steps: 4, elevation: 0 }, { steps: 4, elevation: 0 })).toEqual({ steps: 0, elevation: 0 });
  });
});
