import type { Graphics } from "pixi.js";

/** Broken silhouette in the same 80×55 pixel space as the intact tank. */
export const WRECK_PIXELS = [
  { x:12,y:39,w:46,h:14,color:0x69716e },
  { x:8,y:43,w:8,h:8,color:0x454d4a },
  { x:58,y:45,w:10,h:8,color:0x454d4a },
  { x:20,y:33,w:18,h:6,color:0x818986 },
  { x:38,y:35,w:12,h:4,color:0x69716e },
  { x:28,y:27,w:10,h:6,color:0x818986 },
  { x:38,y:29,w:8,h:6,color:0x69716e },
  { x:44,y:31,w:10,h:4,color:0x818986 },
  { x:58,y:48,w:14,h:4,color:0x818986 },
  { x:16,y:43,w:8,h:6,color:0x000000 },
  { x:30,y:43,w:8,h:6,color:0x000000 },
  { x:46,y:47,w:8,h:6,color:0x000000 },
  { x:38,y:37,w:4,h:6,color:0x202624 },
  { x:42,y:41,w:4,h:6,color:0x202624 },
] as const;
export const drawTankWreck = (g: Graphics): void => {
  g.clear();
  for (const p of WRECK_PIXELS) g.rect((p.x-38)/8,(p.y-53)/8,p.w/8,p.h/8).fill(p.color);
};
