import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const css = readFileSync(resolve("src/worldUi/yourTurn.css"), "utf8");
const keyframes = (name: string) => css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`))![1]!;

it("opens a scanline in steps during the first 120 ms and keeps the 1800 ms notice", () => {
  expect(css).toContain("animation:your-turn-scan 120ms steps(3,jump-start) both,your-turn-appear 1800ms linear both;");
  const scan = keyframes("your-turn-scan");
  expect(scan).toContain("0% { clip-path:inset(calc(50% - 1px) 50%); }");
  expect(scan).toContain("50% { clip-path:inset(calc(50% - 1px) 0); }");
  expect(scan).toContain("100% { clip-path:inset(0); }");
});
it("still fades out over the last fifth as before", () => {
  const appear = keyframes("your-turn-appear");
  expect(appear).toContain("0%,80% { opacity:1; }");
  expect(appear).toContain("100% { opacity:0; }");
});
it("shows the notice without animation when motion is reduced", () => {
  expect(css).toContain("@media(prefers-reduced-motion:reduce) { .your-turn { animation:none; } }");
});
