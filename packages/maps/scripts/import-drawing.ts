import { readFileSync } from "node:fs";
import { MAP_HEIGHT, MAP_WIDTH } from "@game/sim";
import { z } from "zod";
import { decodeColumns, slabsFromColumns, validateDrawing, type Drawing } from "../src/index.js";

// お絵かきツール（docs/design/02 の 2.8）で保存した JSON から、packages/maps/src/index.ts に貼る MapDefinition を出力する。
// 使い方: pnpm --filter @game/maps import-drawing <drawing.json>
// JSON の形: { "name": "識別子", "label": "表示名", "spawns": [x0, x1], "columns": "top-bottom,...;..." }

/** 識別子は TypeScript の変数名と MAP_NAMES の値になるので、英小文字で始まる英数字に限る */
const savedSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9]*$/, "識別子は英小文字で始まる英数字"),
  label: z.string().optional(),
  spawns: z.tuple([z.number().int(), z.number().int()]),
  columns: z.string(),
});

const file = process.argv[2];
if (!file) {
  console.error("使い方: pnpm --filter @game/maps import-drawing <drawing.json>");
  process.exit(1);
}

const parsed = savedSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
if (!parsed.success) {
  for (const issue of parsed.error.issues) console.error(`${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}
const saved = parsed.data;
const drawing: Drawing = { name: saved.name, spawns: saved.spawns, columns: decodeColumns(saved.columns) };
const errors = validateDrawing(drawing);
if (errors.length > 0) {
  for (const e of errors) console.error(e);
  process.exit(1);
}

const slabList = slabsFromColumns(drawing.columns);
const points = (list: readonly (readonly [number, number])[]): string => `[${list.map(([x, y]) => `[${x}, ${y}]`).join(", ")}]`;
const body = slabList.map((s) => `      { top: ${points(s.top)}, bottom: ${points(s.bottom)} },`).join("\n");
const vertexCount = slabList.reduce((n, s) => n + s.top.length + s.bottom.length, 0);

console.log(`/** ${saved.label ?? saved.name}。お絵かきツールから取り込んだ（板 ${slabList.length} 枚、頂点 ${vertexCount}）。大きさ ${MAP_WIDTH} × ${MAP_HEIGHT} */
const ${saved.name}: MapDefinition = {
  name: "${saved.name}",
  spawns: [${saved.spawns[0]}, ${saved.spawns[1]}],
  build: () =>
    slabs([
${body}
    ]),
};`);
