import { expect, it } from "vitest";
import { announceTurn, showsNotice } from "../src/worldUi/turnNotice";

// 「あなたのターン」は手番ごとに 1 回だけ出す。落下で操作が一時的に止まっても出し直さない

it("操作できるようになった手番を告知する", () => {
  expect(announceTurn(null, "m/1", false)).toBeNull();
  expect(announceTurn(null, "m/1", true)).toBe("m/1");
});

it("同じ手番で操作が止まって戻っても、告知し直さない", () => {
  const first = announceTurn(null, "m/1", true);
  const paused = announceTurn(first, "m/1", false);
  expect(paused).toBe("m/1");
  expect(announceTurn(paused, "m/1", true)).toBe("m/1");
});

it("同じ人の続けての手番も、手番が変われば告知する", () => {
  expect(announceTurn("m/1", "m/2", true)).toBe("m/2");
});

it("出している告知は、操作が止まっても同じ手番のあいだは消さない", () => {
  expect(showsNotice("m/1", "m/1")).toBe(true);
  expect(showsNotice("m/1", "m/2")).toBe(false);
  expect(showsNotice(null, "m/1")).toBe(false);
});
