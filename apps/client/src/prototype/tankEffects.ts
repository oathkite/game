type Pose = { readonly hp: number; readonly falling?: boolean };
type Effect = { readonly id: string; readonly frame: number; readonly x: number; readonly y: number; readonly alpha: number };
const frameAt = (age: number, ends: readonly number[]) => ends.findIndex(end => age < end);
/** Authored baseline-v2 emitters, converted from art-space anchors into world cells. */
export const createTankEffects = () => {
  let hp: number | null = null, falling = false, destroyedAt = -Infinity, landedAt = -Infinity;
  return (pose: Pose, now: number, reducedMotion = false): readonly Effect[] => {
    if (hp !== null && hp > 0 && pose.hp <= 0) destroyedAt = now;
    if (pose.hp > 0) destroyedAt = -Infinity;
    if (falling && !pose.falling) landedAt = now;
    hp = pose.hp; falling = pose.falling === true;
    if (reducedMotion) return [];
    const result: Effect[] = [], deathAge = now - destroyedAt, landAge = now - landedAt;
    const add = (id: string, frame: number, x: number, y: number, alpha: number) => {
      if (frame >= 0) result.push({ id: `effect-${id}`, frame, x: (x - 192) / 12, y: (y - 240) / 12, alpha });
    };
    const wreck = pose.hp <= 0 && deathAge >= 600;
    if ((pose.hp > 0 && pose.hp <= 25) || wreck) {
      const count = wreck ? 4 : 3;
      for (let i = 0; i < count; i++) {
        const age = (now + i * 900 / count) % 900, phase = age / 900;
        add("smoke", frameAt(age, [150, 350, 600, 900]), 30 + i * 7, 95 + (wreck ? 8 : 0) - Math.round(phase * 16), .75 * Math.sin(Math.PI * phase));
      }
    }
    if (pose.hp <= 0 && deathAge < 600) {
      for (const [delay, x, y] of [[0, 85, 105], [80, 70, 110], [140, 112, 108]] as const) {
        const age = deathAge - delay;
        if (age >= 0) add("explosion", frameAt(age * 590 / (600 - delay), [70, 190, 410, 590]), x, y, Math.min(1, (600 - deathAge) / 130));
      }
    }
    if (pose.hp > 0 && !pose.falling && landAge < 450) for (const x of [58, 86, 116]) {
      add("dust", frameAt(landAge, [60, 160, 290, 450]), x, 144, .8 * Math.min(1, (450 - landAge) / 100));
    }
    return result;
  };
};
