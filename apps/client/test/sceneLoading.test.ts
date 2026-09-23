import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SceneLoading, SceneLoadingView, type LoadingStep } from "../src/worldUi/SceneLoading";
import { filledDots, loadingAnnouncement, showsProgress } from "../src/worldUi/sceneLoadingModel";
import { labLoadingSteps, ROOM_CONNECTING_STATUS, roomLoadingSteps } from "../src/worldUi/connectionSteps";

const identity = (text: string) => text;
const three: readonly LoadingStep[] = [
  { label: "画面を読み込み中", state: "done" },
  { label: "サーバーへ接続中", state: "active" },
  { label: "部屋を同期中", state: "active" },
];
const view = (steps: readonly LoadingStep[]) => renderToStaticMarkup(createElement(SceneLoadingView, { steps }));

it("maps done steps onto ten dots without inventing a percentage", () => {
  expect(filledDots([])).toBe(0);
  expect(filledDots([{ label: "a", state: "active" }, { label: "b", state: "active" }])).toBe(0);
  expect(filledDots(three)).toBe(3);
  expect(filledDots([{ label: "a", state: "done" }, { label: "b", state: "active" }])).toBe(5);
  expect(filledDots([{ label: "a", state: "done" }, { label: "b", state: "done" }])).toBe(10);
  expect(filledDots([{ label: "a", state: "done" }, { label: "b", state: "error" }])).toBe(5);
});
it("shows the bar only for two or more steps", () => {
  expect(showsProgress([])).toBe(false);
  expect(showsProgress([{ label: "a", state: "active" }])).toBe(false);
  expect(showsProgress(three)).toBe(true);
  expect(view([{ label: "画面を読み込み中", state: "active" }])).not.toContain("scene-loading-dots");
  expect(view(three).match(/<i /g)).toHaveLength(10);
  expect(view(three).match(/data-filled="true"/g)).toHaveLength(3);
});
it("announces the whole current step, not the partly typed text", () => {
  expect(loadingAnnouncement([])).toBe("");
  expect(loadingAnnouncement(three)).toBe("サーバーへ接続中");
  expect(loadingAnnouncement([{ label: "画面を読み込み中", state: "done" }])).toBe("画面を読み込み中 OK");
  expect(loadingAnnouncement([{ label: "接続に失敗しました", state: "error" }])).toBe("接続に失敗しました NG");
  const html = view(three);
  expect(html).toContain('role="status"');
  expect(html).toContain('<span class="scene-loading-sr">サーバーへ接続中</span>');
  expect(html).toContain('<ol aria-hidden="true">');
});
it("writes one terminal line per step with OK, NG or a cursor", () => {
  const html = view([{ label: "画面を読み込み中", state: "done" }, { label: "接続に失敗しました", state: "error" }, { label: "部屋を同期中", state: "active" }]);
  expect(html).toContain("画面を読み込み中 ...... <b>OK</b>");
  expect(html).toContain("接続に失敗しました ...... <b>NG</b>");
  expect(html).toContain('<li data-state="active"><span class="scene-loading-prompt">&gt; </span><span class="scene-loading-cursor"></span></li>');
});
it("renders nothing before the delay and for an empty list", () => {
  expect(renderToStaticMarkup(createElement(SceneLoading, { steps: three }))).toBe("");
  expect(view([])).toBe("");
});
it("lists only the room steps that are actually being waited for", () => {
  expect(roomLoadingSteps({ status: ROOM_CONNECTING_STATUS, joined: false, hasRoom: false }, identity)).toEqual([{ label: "サーバーへ接続中", state: "active" }]);
  expect(roomLoadingSteps({ status: "", joined: true, hasRoom: false }, identity)).toEqual([{ label: "サーバーへ接続中", state: "done" }, { label: "部屋を同期中", state: "active" }]);
  expect(roomLoadingSteps({ status: "", joined: true, hasRoom: true }, identity)).toBeNull();
  expect(roomLoadingSteps({ status: "", joined: false, hasRoom: false }, identity)).toBeNull();
  expect(roomLoadingSteps({ status: "対戦サーバーに接続できません。", joined: true, hasRoom: false }, identity)).toBeNull();
});
it("keeps the battle connection error text as the failed line", () => {
  expect(labLoadingSteps("接続中", identity)).toEqual([{ label: "サーバーへ接続中", state: "active" }]);
  expect(labLoadingSteps("接続済み", identity)).toEqual([{ label: "サーバーへ接続中", state: "done" }, { label: "対戦データを受信中", state: "active" }]);
  expect(labLoadingSteps("接続に失敗しました", identity)).toEqual([{ label: "接続に失敗しました", state: "error" }]);
});
