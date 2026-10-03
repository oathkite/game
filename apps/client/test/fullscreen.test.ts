import { describe, expect, it, vi } from "vitest";
import { fullscreenSupported, isFullscreen, subscribeFullscreen, toggleFullscreen, type FullscreenDocument } from "../src/worldUi/fullscreen";

// 全画面の API は標準の名前と、iPad の Safari の webkit 接頭辞の名前がある（設計書 30 章）。偽の document で両方を確かめる。
type Fake = FullscreenDocument & { fullscreenElement?: unknown; webkitFullscreenElement?: unknown };
const root = {};
const standard = (overrides: Partial<Fake> = {}): Fake => Object.assign(new EventTarget(), {
  fullscreenEnabled: true,
  fullscreenElement: null,
  documentElement: { requestFullscreen: vi.fn(() => Promise.resolve()) },
  exitFullscreen: vi.fn(() => Promise.resolve()),
  ...overrides,
});
const webkit = (overrides: Partial<Fake> = {}): Fake => Object.assign(new EventTarget(), {
  webkitFullscreenEnabled: true,
  webkitFullscreenElement: null,
  documentElement: { webkitRequestFullscreen: vi.fn() },
  webkitExitFullscreen: vi.fn(),
  ...overrides,
});

describe("fullscreenSupported", () => {
  it("is true when either the standard or the webkit API is enabled", () => {
    expect(fullscreenSupported(standard())).toBe(true);
    expect(fullscreenSupported(webkit())).toBe(true);
  });
  it("is false when the browser disables it or lacks the request method (iPhone Safari)", () => {
    expect(fullscreenSupported(standard({ fullscreenEnabled: false }))).toBe(false);
    expect(fullscreenSupported(standard({ documentElement: {} }))).toBe(false);
    expect(fullscreenSupported(Object.assign(new EventTarget(), { documentElement: {} }))).toBe(false);
  });
});

describe("isFullscreen", () => {
  it("reads whichever fullscreen element the browser reports", () => {
    expect(isFullscreen(standard())).toBe(false);
    expect(isFullscreen(standard({ fullscreenElement: root }))).toBe(true);
    expect(isFullscreen(webkit())).toBe(false);
    expect(isFullscreen(webkit({ webkitFullscreenElement: root }))).toBe(true);
    expect(isFullscreen(Object.assign(new EventTarget(), { documentElement: {} }))).toBe(false);
  });
});

describe("toggleFullscreen", () => {
  it("requests fullscreen on the whole document when not fullscreen", async () => {
    const doc = standard();
    await toggleFullscreen(doc);
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(doc.exitFullscreen).not.toHaveBeenCalled();
  });
  it("exits when already fullscreen", async () => {
    const doc = standard({ fullscreenElement: root });
    await toggleFullscreen(doc);
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(doc.documentElement.requestFullscreen).not.toHaveBeenCalled();
  });
  it("prefers the standard API when both exist", async () => {
    const doc = standard({ documentElement: { requestFullscreen: vi.fn(() => Promise.resolve()), webkitRequestFullscreen: vi.fn() } });
    await toggleFullscreen(doc);
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(doc.documentElement.webkitRequestFullscreen).not.toHaveBeenCalled();
  });
  it("falls back to the webkit API in both directions", async () => {
    const entering = webkit();
    await toggleFullscreen(entering);
    expect(entering.documentElement.webkitRequestFullscreen).toHaveBeenCalledTimes(1);
    const leaving = webkit({ webkitFullscreenElement: root });
    await toggleFullscreen(leaving);
    expect(leaving.webkitExitFullscreen).toHaveBeenCalledTimes(1);
  });
  it("does not throw when the browser refuses (no user activation, permissions policy)", async () => {
    const rejecting = standard({ documentElement: { requestFullscreen: () => Promise.reject(new TypeError("Permissions check failed")) } });
    await expect(toggleFullscreen(rejecting)).resolves.toBeUndefined();
    const throwing = webkit({ documentElement: { webkitRequestFullscreen: () => { throw new Error("denied"); } } });
    await expect(toggleFullscreen(throwing)).resolves.toBeUndefined();
  });
  it("does nothing when unsupported", async () => {
    await expect(toggleFullscreen(Object.assign(new EventTarget(), { documentElement: {} }))).resolves.toBeUndefined();
  });
});

describe("subscribeFullscreen", () => {
  it("notifies on both the standard and the webkit change events until unsubscribed", () => {
    const doc = standard();
    const listener = vi.fn();
    const stop = subscribeFullscreen(doc, listener);
    doc.dispatchEvent(new Event("fullscreenchange"));
    doc.dispatchEvent(new Event("webkitfullscreenchange"));
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    doc.dispatchEvent(new Event("fullscreenchange"));
    doc.dispatchEvent(new Event("webkitfullscreenchange"));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
