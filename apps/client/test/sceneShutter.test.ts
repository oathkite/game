import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { shutterDirection } from "../src/worldUi/sceneShutter";

const css = readFileSync(resolve("src/worldUi/worldUi.css"), "utf8");

it("uses the same top-down shutter for every move and enters battle like a CRT", () => {
  expect(shutterDirection("rooms")).toBe("forward");
  expect(shutterDirection("lobby")).toBe("forward");
  expect(shutterDirection("result")).toBe("forward");
  expect(shutterDirection("battle")).toBe("battle");
});
it("gives every direction a stepped close and open of the same 400 ms", () => {
  expect(css).toMatch(/\.world-shutter\[data-direction\] \{ animation:400ms steps\(8,end\) both; \}/);
  for (const direction of ["forward", "battle"]) {
    for (const phase of ["close", "open"]) {
      expect(css).toContain(`animation-name:world-shutter-${direction}-${phase};`);
      expect(css).toMatch(new RegExp(`@keyframes world-shutter-${direction}-${phase} \\{`));
    }
  }
  expect(css).not.toMatch(/\.world-shutter[^{]*\{[^}]*transition/);
});
it("keeps the shutter still when motion is reduced", () => {
  expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\) \{ \.world-shutter\[data-direction\],\.world-closing \.world-shutter\[data-direction\] \{ animation:none; \} \}/);
});
