import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { english } from "../src/i18n/messages";
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
});
it("every explicitly translated UI message has an English entry", () => {
  const missing = files(resolve("src")).flatMap(path => [...readFileSync(path, "utf8").matchAll(/\bt\("([^"\n]+)"/g)]
    .filter(match => !Object.hasOwn(english, match[1]!)).map(match => `${path}: ${match[1]}`));
  expect(missing).toEqual([]);
});
