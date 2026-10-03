import { Container, type Ticker } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ITEM_POPUP_MS, itemPopupPose, spawnItemPopup } from "@/game/itemPopup";
import { ITEM_POPUP_FRESH_MS, itemPopupOf, type ItemPopupFrame } from "@/worldUi/itemPopupRule";

// 相手がアイテムを使ったときに機体の上へ出すアイコン（設計書 42.8）

afterEach(() => vi.unstubAllGlobals());

const replaying = (playerId: string, item?: "double" | "teleport", startsAt = 1000): ItemPopupFrame =>
  ({ phase: "replaying", replay: { startsAt, shooter: { playerId, ...(item ? { item } : {}) } } });

describe("itemPopupOf", () => {
  it("相手がアイテムを使った再生では、撃った機体とアイテムを返して出す", () => {
    expect(itemPopupOf(replaying("p2", "teleport"), "p1", 1000, null)).toEqual({ key: 1000, playerId: "p2", item: "teleport", show: true });
  });
  it("自分の射撃では出さないが、扱った印は返す", () => {
    expect(itemPopupOf(replaying("p1", "double"), "p1", 1000, null)).toMatchObject({ key: 1000, show: false });
  });
  it("観戦者（撃っていない参加者）にも出す", () => {
    expect(itemPopupOf(replaying("p2", "double"), "watcher", 1100, null)?.show).toBe(true);
  });
  it("アイテムを使わない射撃では何も返さない", () => {
    expect(itemPopupOf(replaying("p2"), "p1", 1000, null)).toBeNull();
  });
  it("操作中は、相手がアイテムを選んでいても何も返さない（選択は射撃確定まで見えない。42.1）", () => {
    expect(itemPopupOf({ ...replaying("p2", "teleport"), phase: "acting" }, "p1", 1000, null)).toBeNull();
    expect(itemPopupOf({ phase: "acting", replay: null }, "p1", 1000, null)).toBeNull();
  });
  it("同じ再生には 1 回だけ出す", () => {
    expect(itemPopupOf(replaying("p2", "double"), "p1", 1200, 1000)).toBeNull();
  });
  it("再生の開始前は出さず、開始の瞬間から出す", () => {
    expect(itemPopupOf(replaying("p2", "double"), "p1", 999, null)).toBeNull();
    expect(itemPopupOf(replaying("p2", "double"), "p1", 1000, null)?.show).toBe(true);
  });
  it("開始から 1500 ms を過ぎて初めて見た再生は、印だけ付けて出さない（途中参加と再接続）", () => {
    expect(itemPopupOf(replaying("p2", "double"), "p1", 1000 + ITEM_POPUP_FRESH_MS, null)?.show).toBe(true);
    expect(itemPopupOf(replaying("p2", "double"), "p1", 1001 + ITEM_POPUP_FRESH_MS, null)).toMatchObject({ key: 1000, show: false });
  });
});

describe("itemPopupPose", () => {
  it("出た直後に 1 段大きく弾み、浮き上がり、後半で消える", () => {
    expect(itemPopupPose(0, false)).toEqual({ dot: 4, rise: 0, alpha: 1 });
    expect(itemPopupPose(200, false).dot).toBe(3);
    expect(itemPopupPose(ITEM_POPUP_MS / 3, false).rise).toBe(16);
    expect(itemPopupPose(ITEM_POPUP_MS, false)).toMatchObject({ rise: 16, alpha: 0 });
  });
  it("動きを減らす設定では弾まず浮かず、薄くなるだけ", () => {
    expect(itemPopupPose(0, true)).toEqual({ dot: 3, rise: 0, alpha: 1 });
    expect(itemPopupPose(ITEM_POPUP_MS, true)).toEqual({ dot: 3, rise: 0, alpha: 0 });
  });
});

describe("spawnItemPopup", () => {
  const spawn = () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const parent = new Container(), onEnd = vi.fn();
    const steps: (() => void)[] = [];
    const ticker = { add: (fn: () => void) => steps.push(fn), remove: vi.fn(), deltaMS: 100 } as unknown as Ticker;
    spawnItemPopup({ parent, ticker, item: "teleport", x: 100, y: 100, onEnd });
    return { parent, onEnd, step: () => steps.forEach(fn => fn()) };
  };
  it("枠つきのアイコンを、弾む間は 4 px の画素で描く（8 × 4 + 隙間 2 × 2 + 枠 2 × 2）", () => {
    expect(spawn().parent.children[0]!.height).toBe(8 * 4 + 8);
  });
  it("出ている時間が過ぎたら消えて onEnd を呼ぶ", () => {
    const popup = spawn();
    for (let i = 0; i < ITEM_POPUP_MS / 100 - 1; i++) popup.step();
    expect(popup.onEnd).not.toHaveBeenCalled();
    popup.step();
    expect(popup.onEnd).toHaveBeenCalledOnce();
    expect(popup.parent.children[0]?.destroyed ?? true).toBe(true);
  });
});
