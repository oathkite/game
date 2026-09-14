type Icon = "crown" | "lock" | "check" | "close" | "settings" | "focus" | "follow" | "up" | "down" | "left" | "right";
const patterns = {
  crown: ["........","1..11..1","11.11.11","11111111",".111111.",".111111.","........","........"],
  lock: ["..1111..",".1....1.",".1....1.","11111111","111..111","111..111","11111111","11111111"],
  check: ["........",".......1","......1.",".....1..","1...1...",".1.1....","..1.....","........"],
  close: ["1......1",".1....1.","..1..1..","...11...","...11...","..1..1..",".1....1.","1......1"],
  settings: ["...11...",".111111.",".11..11.","11.11.11","11.11.11",".11..11.",".111111.","...11..."],
  focus: ["...11...","..1111..",".11..11.","11.11.11","11.11.11",".11..11.","..1111..","...11..."],
  follow: ["..111111",".....111","....1111","...11.11","..11..11",".11.....","11......","1......."],
  up: ["...11...","..1111..",".111111.","11111111","...11...","...11...","...11...","........"],
};
export const DotIcon = ({ name }: { readonly name: Icon }) => {
  const arrow = name === "left" || name === "right" || name === "down";
  const pattern = patterns[arrow ? "up" : name as keyof typeof patterns];
  return <svg className="dot-icon" viewBox="0 0 8 8" aria-hidden="true" shapeRendering="crispEdges">
    {pattern.flatMap((row,y) => [...row].flatMap((v,x) => {
      if (v !== "1") return [];
      const point = name === "right" ? [7-y,x] : name === "down" ? [7-x,7-y] : name === "left" ? [y,7-x] : [x,y];
      return [<rect key={`${x}/${y}`} x={point[0]} y={point[1]} width="1" height="1" fill="currentColor" />];
    }))}
  </svg>;
};
