import { describe, expect, it } from "vitest";
import { SWIPE_DEADZONE_PX, SWIPE_ELEVATION_PX, SWIPE_STEP_PX, swipeAdvance, swipeAxis, swipeDelta, type SwipeDelta } from "@/ui/swipeAim";

// マップをなぞる操作。横は移動、縦は仰角。向きは指を置いてから離すまで変えない。

describe("swipeAxis", () => {
  it("指のぶれの範囲では向きが決まらない", () => {
    expect(swipeAxis(0, 0)).toBeNull();
    expect(swipeAxis(SWIPE_DEADZONE_PX - 1, SWIPE_DEADZONE_PX - 1)).toBeNull();
  });

  it("大きく動いた方の向きになる", () => {
    expect(swipeAxis(30, 5)).toBe("move");
    expect(swipeAxis(-30, 5)).toBe("move");
    expect(swipeAxis(5, -30)).toBe("aim");
    expect(swipeAxis(5, 30)).toBe("aim");
  });

  it("同じだけ動いたら移動にする", () => {
    expect(swipeAxis(20, 20)).toBe("move");
  });
});

describe("swipeDelta", () => {
  it("横になぞると歩数になり、右が正になる", () => {
    expect(swipeDelta(SWIPE_STEP_PX, 0, "move")).toEqual({ steps: 1, elevation: 0 });
    expect(swipeDelta(SWIPE_STEP_PX * 3, 0, "move")).toEqual({ steps: 3, elevation: 0 });
    expect(swipeDelta(-SWIPE_STEP_PX * 2, 0, "move")).toEqual({ steps: -2, elevation: 0 });
  });

  it("上へなぞると仰角が上がる", () => {
    expect(swipeDelta(0, -SWIPE_ELEVATION_PX * 5, "aim")).toEqual({ steps: 0, elevation: 5 });
    expect(swipeDelta(0, SWIPE_ELEVATION_PX * 4, "aim")).toEqual({ steps: 0, elevation: -4 });
  });

  it("向きが移動なら、縦にどれだけ動いても仰角は変わらない", () => {
    expect(swipeDelta(SWIPE_STEP_PX * 2, -SWIPE_ELEVATION_PX * 10, "move")).toEqual({ steps: 2, elevation: 0 });
  });

  it("向きが角度なら、横にどれだけ動いても歩数は変わらない", () => {
    expect(swipeDelta(SWIPE_STEP_PX * 5, -SWIPE_ELEVATION_PX * 3, "aim")).toEqual({ steps: 0, elevation: 3 });
  });

  it("1 歩に満たない移動は切り捨てる", () => {
    expect(swipeDelta(SWIPE_STEP_PX - 1, 0, "move")).toEqual({ steps: 0, elevation: 0 });
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

// 指を置いてから離すまでを通して確かめる。1 回のなぞりで向きが変わらないことが要点である。
describe("なぞっている間の積み重ね", () => {
  /** 押した位置からの移動量の列を流し、送られた歩数と仰角を集める */
  const trace = (points: readonly (readonly [number, number])[]) => {
    let axis: ReturnType<typeof swipeAxis> = null;
    let sent: SwipeDelta = { steps: 0, elevation: 0 };
    const steps: number[] = [];
    let elevation = 0;
    for (const [dx, dy] of points) {
      if (axis === null) axis = swipeAxis(dx, dy);
      if (axis === null) continue;
      const current = swipeDelta(dx, dy, axis);
      const advance = swipeAdvance(sent, current);
      sent = current;
      for (let i = 0; i < Math.abs(advance.steps); i++) steps.push(advance.steps > 0 ? 1 : -1);
      elevation += advance.elevation;
    }
    return { steps, elevation, axis };
  };

  it("横になぞった分だけ歩数が進む", () => {
    const r = trace([[24, 0], [48, 0], [72, 0]]);
    expect(r.steps).toEqual([1, 1, 1]);
    expect(r.elevation).toBe(0);
  });

  it("横になぞった後で縦に持ち替えても、進んだ歩数を戻さない", () => {
    // 右に 50 px なぞって 2 歩進み、そのまま指を 60 px 上げる
    const r = trace([[50, 0], [50, -60]]);
    expect(r.steps).toEqual([1, 1]);
    // 向きは移動のまま変わらないので、仰角も動かない
    expect(r.axis).toBe("move");
    expect(r.elevation).toBe(0);
  });

  it("縦になぞった後で横に持ち替えても、歩数を消費しない", () => {
    const r = trace([[0, -40], [60, -40]]);
    expect(r.steps).toEqual([]);
    expect(r.axis).toBe("aim");
    expect(r.elevation).toBe(5);
  });

  it("指を戻せば、その分だけ歩数も戻る", () => {
    // 同じ向きの中で戻すのは、行き過ぎを直す操作なので歩数も戻ってよい
    const r = trace([[72, 0], [24, 0]]);
    expect(r.steps).toEqual([1, 1, 1, -1, -1]);
  });
});
