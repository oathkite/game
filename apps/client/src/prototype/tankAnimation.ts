type Pose = { readonly x: number; readonly hp: number; readonly flash: boolean };
/** Frame timings from baseline-v2's authored idle/move/low-hp clips. */
export const createTankAnimation = () => {
  let lastX: number | null = null, movedAt = -Infinity, beganAt = 0, previous = "";
  return (pose: Pose, now: number, reducedMotion = false) => {
    if (lastX !== null && Math.abs(lastX - pose.x) > 0.001) movedAt = now;
    lastX = pose.x;
    const state = pose.hp <= 0 ? "wreck" : pose.flash ? "hit" : now - movedAt < 150 ? "move" : pose.hp <= 25 ? "low" : "idle";
    if (state !== previous) { previous = state; beganAt = now; }
    const elapsed = reducedMotion ? 0 : Math.max(0, now - beganAt);
    if (state === "wreck") return { tracks: 3, pilot: 15 };
    if (state === "hit") return { tracks: 0, pilot: 7 };
    if (state === "move") return { tracks: Math.floor(elapsed / 90) % 3, pilot: 3 + Math.floor(elapsed / 100) % 2 };
    if (state === "low") { const time = elapsed % 1600; return { tracks: 0, pilot: time < 600 || time >= 900 ? 9 : 10 }; }
    const time = elapsed % 1200;
    return { tracks: 0, pilot: time < 500 || time >= 1100 ? 0 : time < 1000 ? 1 : 2 };
  };
};
