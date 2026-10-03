import { describe, expect, it } from "vitest";
import { armsOf, firedArms, seatArms } from "../src/match/tankArms";

// 機体に描く武器。設計書 10.5「自分の選択はすぐに反映し、相手は最後に射撃で確定した武器を表示する。開始時は双方とも slot 0」と 43

describe("機体に描く武器", () => {
  it("撃つ武器を砲身に、装備のもう一方をサブ武器にする", () => {
    expect(armsOf(["laser", "digger"], "laser")).toEqual({ weapon: "laser", sub: "digger" });
    expect(armsOf(["laser", "digger"], "digger")).toEqual({ weapon: "digger", sub: "laser" });
  });
  it("ほかの参加者は、まだ撃っていなければ装備の 1 つ目、撃ったら最後に撃った武器", () => {
    expect(firedArms({ loadout: ["triple", "stinger"] })).toEqual({ weapon: "triple", sub: "stinger" });
    expect(firedArms({ loadout: ["triple", "stinger"], lastWeapon: "stinger" })).toEqual({ weapon: "stinger", sub: "triple" });
  });
  it("自分の席は操作中のスロットか、最後に選んだスロットをすぐに描く", () => {
    const player = { loadout: ["cannon", "floater"] as const, lastWeapon: "cannon" as const };
    expect(seatArms({ mySeat: 0, control: null, lastSlot: 1 }, 0, player).weapon).toBe("floater");
    expect(seatArms({ mySeat: 1, control: null, lastSlot: 1 }, 0, player).weapon).toBe("cannon");
  });
});
