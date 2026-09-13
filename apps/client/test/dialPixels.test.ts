import { expect, it } from "vitest";
import { dialPoint, pixelArc, pixelLine } from "../src/worldUi/dialPixels";
it("draws lines and arcs on a two-unit grid without duplicate cells", () => {
  for(const points of [pixelLine({x:60,y:60},dialPoint(37,46)),pixelArc(170,90,32),pixelArc(0,360,56)]) {
    expect(points.length).toBeGreaterThan(10);
    expect(new Set(points.map(p=>`${p.x}/${p.y}`)).size).toBe(points.length);
    expect(points.every(p=>p.x%2===0&&p.y%2===0)).toBe(true);
  }
  expect(pixelLine({x:60,y:60},{x:60,y:60})).toEqual([{x:60,y:60}]);
});
