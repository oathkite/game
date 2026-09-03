import { describe, expect, it } from "vitest";
import { parseClientMessage, roomCodeSchema } from "../src/index.js";

const fire = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ type: "turn.fire", facing: 1, elevation: 45, power: 60, x: 100, ...over });

describe("parseClientMessage", () => {
  it("正しい turn.fire を受け付ける", () => {
    const r = parseClientMessage(fire());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.message.type).toBe("turn.fire");
  });

  it.each([
    ["仰角の下限未満", fire({ elevation: 9 })],
    ["仰角の上限超過", fire({ elevation: 91 })],
    ["仰角が小数", fire({ elevation: 45.5 })],
    ["パワーが負", fire({ power: -1 })],
    ["パワーの上限超過", fire({ power: 101 })],
    ["向きが 0", fire({ facing: 0 })],
    ["x がマップ外", fire({ x: 400 })],
  ])("%s は拒否する", (_name, raw) => {
    expect(parseClientMessage(raw).ok).toBe(false);
  });

  it("JSON でない文字列は拒否する", () => {
    expect(parseClientMessage("{").ok).toBe(false);
  });

  it("未知の type は拒否する", () => {
    expect(parseClientMessage(JSON.stringify({ type: "hack" })).ok).toBe(false);
  });

  it("空白のみのプレイヤー名は拒否する", () => {
    const raw = JSON.stringify({
      type: "room.join",
      code: "ABCDEF",
      playerId: "player-0001",
      nickname: "   ",
      colors: { primary: "red", secondary: "red" },
    });
    expect(parseClientMessage(raw).ok).toBe(false);
  });

  it("候補にない色は拒否する", () => {
    const raw = JSON.stringify({
      type: "room.ready",
      ready: true,
    });
    expect(parseClientMessage(raw).ok).toBe(true);
    const bad = JSON.stringify({ type: "room.takeSeat", colors: { primary: "green", secondary: "red" } });
    expect(parseClientMessage(bad).ok).toBe(false);
  });
});

describe("roomCodeSchema", () => {
  it("O、0、I、1 を含むコードは拒否する", () => {
    expect(roomCodeSchema.safeParse("ABCDE0").success).toBe(false);
    expect(roomCodeSchema.safeParse("ABCDEO").success).toBe(false);
    expect(roomCodeSchema.safeParse("ABCDEI").success).toBe(false);
    expect(roomCodeSchema.safeParse("ABCDE1").success).toBe(false);
    expect(roomCodeSchema.safeParse("ABCDE2").success).toBe(true);
  });
});
