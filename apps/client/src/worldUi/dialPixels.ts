export type DialPoint = { readonly x: number; readonly y: number };
export const dialPoint = (angle: number, radius: number): DialPoint => ({ x:60+Math.cos(angle*Math.PI/180)*radius, y:60-Math.sin(angle*Math.PI/180)*radius });
export const pixelLine = (a: DialPoint, b: DialPoint): readonly DialPoint[] => {
  const count = Math.ceil(Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y)));
  const points = new Map<string,DialPoint>();
  for(let i=0;i<=count;i++) {
    const t=count ? i/count : 0, x=Math.round((a.x+(b.x-a.x)*t)/2)*2, y=Math.round((a.y+(b.y-a.y)*t)/2)*2;
    points.set(`${x}/${y}`,{x,y});
  }
  return [...points.values()];
};
export const pixelArc = (start: number, end: number, radius: number): readonly DialPoint[] => {
  const points = new Map<string,DialPoint>(), steps=Math.max(1,Math.ceil(Math.abs(end-start)));
  for(let i=0;i<=steps;i++) {
    const p=dialPoint(start+(end-start)*i/steps,radius), x=Math.round(p.x/2)*2,y=Math.round(p.y/2)*2;
    points.set(`${x}/${y}`,{x,y});
  }
  return [...points.values()];
};
